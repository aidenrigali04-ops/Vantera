"use client";
import { useCallback, useRef, useState } from "react";
import type { CopilotEvent } from "@vantera/help-agent";

export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; id?: string }
  | { kind: "confirmation"; actionId: string; tool: string; summary: string; params: Record<string, unknown> }
  | { kind: "outcome"; summary: string; deepLink?: string; undoable: boolean };

function apply(items: ChatItem[], e: CopilotEvent): ChatItem[] {
  switch (e.type) {
    case "text": {
      const next = [...items];
      for (let i = next.length - 1; i >= 0; i--) {
        const cur = next[i];
        if (cur.kind === "assistant") {
          next[i] = { kind: "assistant", text: cur.text + e.delta, id: cur.id };
          return next;
        }
      }
      return [...next, { kind: "assistant", text: e.delta }];
    }
    case "confirmation":
      return [...items, { kind: "confirmation", actionId: e.actionId, tool: e.tool, summary: e.summary, params: e.params }];
    case "outcome":
      return [...items, { kind: "outcome", summary: e.summary, deepLink: e.deepLink, undoable: e.undoable }];
    case "error":
      return [...items, { kind: "assistant", text: e.message }];
    case "tool_status":
    case "navigate": // handled separately (walkthrough driver in Task 11); ignore in item list
    case "meta": // handled below (stores ids)
    default:
      return items;
  }
}

export function useCopilot(surface: string) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const convo = useRef<string | undefined>(undefined);
  const lastAssistantId = useRef<string | undefined>(undefined);
  const downCount = useRef(0);
  const [escalate, setEscalate] = useState(false);
  // optional: surface the latest navigate event for Task 11 to consume
  const [navEvent, setNavEvent] = useState<Extract<CopilotEvent, { type: "navigate" }> | null>(null);

  const stream = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/copilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, surface, conversationId: convo.current }) });
      if (!res.ok || !res.body) { setItems((p) => [...p, { kind: "assistant", text: "Something went wrong. Please try again." }]); return; }
      // start a fresh assistant bubble for streamed text
      setItems((p) => [...p, { kind: "assistant", text: "" }]);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line) as CopilotEvent;
          if (e.type === "meta") {
            convo.current = e.conversationId;
            lastAssistantId.current = e.assistantMessageId;
            // Backfill id onto the most recent assistant item so thumbs can render
            setItems((p) => {
              const next = [...p];
              for (let i = next.length - 1; i >= 0; i--) {
                const cur = next[i];
                if (cur.kind === "assistant") {
                  next[i] = { kind: "assistant", text: cur.text, id: e.assistantMessageId };
                  return next;
                }
              }
              return p;
            });
          }
          else if (e.type === "navigate") setNavEvent(e);
          else setItems((p) => apply(p, e));
        }
      }
    } finally { setBusy(false); }
  }, [surface]);

  const send = useCallback((text: string) => { setItems((p) => [...p, { kind: "user", text }]); return stream({ message: text }); }, [stream]);
  const confirm = useCallback((tool: string, params: Record<string, unknown>) => stream({ message: "", approvedAction: { tool, params } }), [stream]);
  const rate = useCallback(async (value: "up" | "down", messageId?: string) => {
    const id = messageId ?? lastAssistantId.current;
    if (!id) return;
    if (value === "down") { downCount.current += 1; if (downCount.current >= 2) setEscalate(true); }
    await fetch("/api/copilot/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId: id, feedback: value }) });
  }, []);

  return { items, busy, escalate, navEvent, conversationId: convo, send, confirm, rate };
}

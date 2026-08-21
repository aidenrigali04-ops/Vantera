"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ColorOrb } from "./color-orb";
import { ConfirmationCard, OutcomeCard } from "./cards";
import { useCopilot } from "./use-copilot";
import { Walkthrough, type WalkStep } from "./walkthrough";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// --- Suggestion chips by surface ---

const SURFACE_CHIPS: Record<string, string[]> = {
  "/review": [
    "How does the review queue work?",
    "Can I edit a draft before sending?",
    "How do I approve multiple drafts at once?",
  ],
  "/agents": [
    "What's the difference between review and automatic?",
    "How do I pause my Scout Agent?",
    "What happens after I deploy an Outreach Agent?",
  ],
  "/leads": [
    "How are leads scored?",
    "Why is a lead marked as not qualified?",
    "Can I manually add a lead?",
  ],
  "/dashboard": [
    "What do the dashboard metrics mean?",
    "How do I see recent activity?",
    "What can you help me with?",
  ],
};

function getSuggestions(surface: string): string[] {
  // exact match first, then prefix match, then default
  if (SURFACE_CHIPS[surface]) return SURFACE_CHIPS[surface];
  const prefix = Object.keys(SURFACE_CHIPS).find((k) => surface.startsWith(k));
  if (prefix) return SURFACE_CHIPS[prefix];
  return ["What can you help me with?", "How do I get started?", "What does Vantera do?"];
}

// --- MorphPanel ---

interface MorphPanelProps {
  surface: string;
}

export function MorphPanel({ surface }: MorphPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [walkthrough, setWalkthrough] = useState<WalkStep[] | null>(null);

  const router = useRouter();
  const { items, busy, escalate, navEvent, send, confirm, rate } = useCopilot(surface);

  // Handle navigate events emitted by the run loop.
  // setState calls are deferred to avoid synchronous setState-in-effect lint errors.
  useEffect(() => {
    if (!navEvent) return;
    if (navEvent.action === "openPage") {
      const route = String(navEvent.params.route);
      router.push(route);
    } else if (navEvent.action === "highlightElement") {
      const anchor = String(navEvent.params.anchor);
      const id = setTimeout(() => setWalkthrough([{ anchor, note: "Here it is." }]), 0);
      return () => clearTimeout(id);
    } else if (navEvent.action === "startWalkthrough") {
      const steps = navEvent.params.steps as WalkStep[];
      const id = setTimeout(() => setWalkthrough(steps), 0);
      return () => clearTimeout(id);
    }
  }, [navEvent, router]);

  // Close on click-outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // ⌘/ to open, Esc to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  // Focus textarea on open
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [open]);

  const handleSend = useCallback(() => {
    const value = textareaRef.current?.value.trim();
    if (!value || busy) return;
    if (textareaRef.current) textareaRef.current.value = "";
    void send(value);
  }, [busy, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Enter" && (e.metaKey || !e.shiftKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const suggestions = getSuggestions(surface);

  return (
    <>
      {walkthrough && (
        <Walkthrough steps={walkthrough} onClose={() => setWalkthrough(null)} />
      )}
    {/* R2: below lg the pill sits ABOVE the MobileNav bar (bottom-0 z-40) — it must never
        cover the Inbox/Meetings tabs (2026-07-15 audit, screenshot-confirmed). */}
    <div className="fixed bottom-20 right-4 z-50 lg:bottom-6 lg:right-6" ref={panelRef}>
      <AnimatePresence>
        {open && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 460, damping: 36, mass: 0.7 }}
              style={{ originX: 1, originY: 1 }}
              className="absolute bottom-0 right-0 flex h-[min(560px,70dvh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <ColorOrb
                    dimension="20px"
                    tones={{ base: "oklch(22.64% 0 0)" }}
                    spinDuration={15}
                  />
                  <span className="text-sm font-medium">Ask AI</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </Button>
              </div>

              {/* Escalation banner */}
              {escalate && (
                <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-800 shrink-0">
                  Still stuck? Email{" "}
                  <a href="mailto:support@vanterasystem.com" className="underline">
                    support@vanterasystem.com
                  </a>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {items.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">Suggestions</p>
                    {suggestions.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => void send(chip)}
                        className="w-full text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                ) : (
                  items.map((item, i) => {
                    if (item.kind === "user") {
                      return (
                        <div key={i} className="flex justify-end">
                          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-[80%]">
                            {item.text}
                          </div>
                        </div>
                      );
                    }
                    if (item.kind === "assistant") {
                      return (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap">
                            {item.text || (busy && i === items.length - 1 ? (
                              <span className="text-muted-foreground">...</span>
                            ) : null)}
                          </div>
                          {/* Thumbs only on non-empty completed messages */}
                          {item.text && !busy && (
                            <ThumbButtons item={item} rate={rate} />
                          )}
                        </div>
                      );
                    }
                    if (item.kind === "confirmation") {
                      return (
                        <ConfirmationCard
                          key={i}
                          summary={item.summary}
                          onApprove={() => void confirm(item.tool, item.params)}
                          onDecline={() => {
                            // no-op decline — just shows in the list
                          }}
                        />
                      );
                    }
                    if (item.kind === "outcome") {
                      const inverse =
                        item.tool === "pauseCampaign" ? "resumeCampaign" :
                        item.tool === "resumeCampaign" ? "pauseCampaign" :
                        null;
                      return (
                        <OutcomeCard
                          key={i}
                          summary={item.summary}
                          deepLink={item.deepLink}
                          undoable={item.undoable}
                          onUndo={item.undoable && inverse ? () => void confirm(inverse, {}) : undefined}
                        />
                      );
                    }
                    return null;
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Ask anything… (Enter to send)"
                    className="resize-none min-h-0 text-sm py-2"
                    rows={2}
                    onKeyDown={handleKeyDown}
                    disabled={busy}
                  />
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={busy}
                    className="shrink-0"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <motion.button
            key="pill"
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            onClick={() => setOpen(true)}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-2 shadow-lg"
          >
            <ColorOrb dimension="24px" tones={{ base: "oklch(22.64% 0 0)" }} spinDuration={15} />
            <span className="text-sm font-medium pr-1">Ask AI</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

// --- ThumbButtons ---

function ThumbButtons({
  item,
  rate,
}: {
  item: { kind: "assistant"; text: string; id?: string };
  rate: (value: "up" | "down", messageId?: string) => Promise<void>;
}) {
  const [rated, setRated] = useState<"up" | "down" | null>(null);

  const handleRate = useCallback(
    async (value: "up" | "down") => {
      if (rated || !item.id) return;
      setRated(value);
      await rate(value, item.id);
    },
    [rated, item.id, rate]
  );

  if (!item.id) return null;

  return (
    <div className="flex gap-1 ml-1">
      <button
        onClick={() => void handleRate("up")}
        className={cn(
          "text-xs rounded px-1 py-0.5 transition-colors",
          rated === "up" ? "text-[var(--positive)]" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Helpful"
        disabled={rated !== null}
      >
        👍
      </button>
      <button
        onClick={() => void handleRate("down")}
        className={cn(
          "text-xs rounded px-1 py-0.5 transition-colors",
          rated === "down" ? "text-red-500" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Not helpful"
        disabled={rated !== null}
      >
        👎
      </button>
    </div>
  );
}

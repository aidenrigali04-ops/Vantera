"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDraftEdit, type ReviewActionState } from "@/app/(app)/approvals/actions";

/**
 * The side peek's building blocks: a collapsible `Section` (open/closed persisted per section),
 * the Signals timeline, and the queued-draft Message section. Kept out of lead-profile.tsx so the
 * profiler stays a composition file.
 */

// ── Persisted open/closed state ──────────────────────────────────────────────
// Same pattern as the Prospects density toggle: localStorage read through useSyncExternalStore.
// The snapshot is the raw string (stable by value), parsed in render; the server snapshot is ""
// so SSR/hydration always render the defaults. When storage is unavailable (private mode, blocked
// site data) the toggles live in `memorySections` for the session so sections still open/close.
const SECTIONS_KEY = "vantera:peek:sections";
let memorySections: string | null = null;
let sectionListeners: Array<() => void> = [];
function subscribeSections(cb: () => void): () => void {
  sectionListeners.push(cb);
  window.addEventListener("storage", cb);
  return () => {
    sectionListeners = sectionListeners.filter((l) => l !== cb);
    window.removeEventListener("storage", cb);
  };
}
function readSectionsRaw(): string {
  if (memorySections !== null) return memorySections;
  try {
    return window.localStorage.getItem(SECTIONS_KEY) ?? "";
  } catch {
    return "";
  }
}
function parseSections(raw: string): Record<string, boolean> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
export function writeSection(id: string, open: boolean) {
  const next = JSON.stringify({ ...parseSections(readSectionsRaw()), [id]: open });
  try {
    window.localStorage.setItem(SECTIONS_KEY, next);
  } catch {
    memorySections = next; // storage blocked — keep toggling in memory
  }
  for (const l of sectionListeners) l();
}
/** Test seam: the current persisted map (storage, or the in-memory fallback). */
export function readSections(): Record<string, boolean> {
  return parseSections(readSectionsRaw());
}

export type PeekSectionId =
  | "signals"
  | "rank"
  | "prospect"
  | "company"
  | "message"
  | "fit"
  | "crm"
  | "notes";

/** One collapsible peek section. `focus` forces it open (and scrolls to it) on first render —
 *  the `+N` chip and `initialSection` use it; a manual toggle hands control back to the store. */
export function Section({
  id,
  title,
  defaultOpen = true,
  focus = false,
  aside,
  children,
}: {
  id: PeekSectionId;
  title: string;
  defaultOpen?: boolean;
  focus?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const raw = useSyncExternalStore(subscribeSections, readSectionsRaw, () => "");
  const stored = parseSections(raw)[id];
  const [forced, setForced] = useState(focus);
  const open = forced || (stored ?? defaultOpen);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "start" });
  }, [focus]);

  const bodyId = `peek-section-${id}`;
  return (
    <section ref={ref} className="border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setForced(false);
            writeSection(id, !open);
          }}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-mid)] transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
          {title}
        </button>
        {aside}
      </div>
      {open && (
        <div id={bodyId} className="mt-3">
          {children}
        </div>
      )}
    </section>
  );
}

// ── Signals timeline ─────────────────────────────────────────────────────────

export type PeekSignal = {
  kind: string;
  label: string | null;
  detail?: string | null;
  level?: string | null;
  source?: string | null;
  observed_at?: string | null;
};
export type PeekPost = { post_ref: string; headline: string | null; detail: string | null; observed_at: string };

// Absolute dates — deterministic in render (no clock read); "3d ago" lives in the table cell,
// precomputed on the server.
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? dateFmt.format(t) : null;
}
const ts = (iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : -Infinity;
};
const isUrl = (ref: string) => /^https?:\/\//.test(ref);

/** Every captured signal and in-market post, newest first. */
export function SignalsTimeline({ signals, posts }: { signals: PeekSignal[]; posts: PeekPost[] }) {
  type Item = { key: string; at: string | null | undefined; node: React.ReactNode };
  const items: Item[] = [
    ...signals.map((s, i) => ({
      key: `s${i}`,
      at: s.observed_at,
      node: (
        <>
          <p className="text-sm font-medium text-[var(--ink)]">
            {s.label?.trim() || s.kind}
            {s.level && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{s.level}</span>}
          </p>
          {s.detail && <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>}
        </>
      ),
    })),
    ...posts.map((p, i) => {
      const text = p.headline?.trim() || p.detail?.trim() || "In-market post";
      return {
        key: `p${i}`,
        at: p.observed_at,
        node: (
          <>
            <p className="flex items-center gap-1 text-sm font-medium text-[var(--positive)]">
              <Radar className="size-3 shrink-0" aria-hidden />
              {isUrl(p.post_ref) ? (
                <a
                  href={p.post_ref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 underline underline-offset-2"
                >
                  <span className="truncate">{text}</span>
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              ) : (
                <span className="min-w-0 truncate">{text}</span>
              )}
            </p>
            {p.headline && p.detail && <p className="mt-0.5 text-xs text-muted-foreground">{p.detail}</p>}
          </>
        ),
      };
    }),
  ].sort((a, b) => ts(b.at) - ts(a.at));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No signals captured yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((it) => (
        <li key={it.key} className="flex gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--acc)]" aria-hidden />
          <div className="min-w-0 flex-1">{it.node}</div>
          {fmtDate(it.at) && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {fmtDate(it.at)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

// ── Message (queued draft) ───────────────────────────────────────────────────

export type QueuedDraft = {
  id: string;
  body: string;
  status: string;
  linkedin_stage: string | null;
  origin: string | null;
  style_flags: unknown;
};
export type RegenerateDraft = (
  sendId: string,
  steer: string
) => Promise<{ body?: string; styleFlags?: string | null; error?: string }>;

const DRAFT_STATUS: Record<string, string> = {
  pending_review: "Waiting for your approval",
  approved: "Approved",
  scheduled: "Scheduled to send",
};
const STAGE_LABEL: Record<string, string> = {
  invite: "Connection note",
  message: "Message",
};

function flagsText(flags: unknown): string | null {
  if (typeof flags === "string") return flags.trim() || null;
  if (Array.isArray(flags) && flags.length > 0) return flags.map(String).join(" · ");
  return null;
}

/** The prospect's queued draft, editable while it waits in review. Regenerate shows only when the
 *  caller supplies `onRegenerate` (the steerable regenerate action ships separately). */
export function MessageSection({
  draft,
  onRegenerate,
  initialEditing = false,
  initialError,
}: {
  draft: QueuedDraft;
  onRegenerate?: RegenerateDraft;
  /** test/preview seams: start in the editor, optionally with a save error showing */
  initialEditing?: boolean;
  initialError?: string;
}) {
  const [body, setBody] = useState(draft.body);
  const [flags, setFlags] = useState<string | null>(flagsText(draft.style_flags));
  const [editing, setEditing] = useState(initialEditing);
  const [steer, setSteer] = useState("");
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const editable = draft.status === "pending_review";

  const router = useRouter();
  // Only what the server confirms it wrote reaches the screen: the returned body + re-linted flags.
  // An error (draft no longer pending, or not allowed) keeps the editor open with the message.
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(async (prev, fd) => {
    const res = await saveDraftEdit(prev, fd);
    if (!res.error) {
      setBody(res.body ?? String(fd.get("body") ?? "").trim());
      setFlags(res.styleFlags ?? null);
      setEditing(false);
      router.refresh(); // the table row and any remount read the saved draft
    }
    return res;
  }, initialError ? { error: initialError } : {});

  const regenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await onRegenerate(draft.id, steer.trim());
      if (res.error) setRegenError(res.error);
      else {
        if (res.body != null) setBody(res.body);
        if (res.styleFlags !== undefined) setFlags(res.styleFlags);
        setSteer("");
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {[draft.linkedin_stage ? (STAGE_LABEL[draft.linkedin_stage] ?? draft.linkedin_stage) : null, DRAFT_STATUS[draft.status] ?? draft.status]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {editing ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="sendId" value={draft.id} />
          <input type="hidden" name="channel" value="linkedin" />
          <textarea
            name="body"
            defaultValue={body}
            rows={6}
            aria-label="Edit message"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-sm focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[var(--r-btn)] bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          {state.error && (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--ink)]">{body}</p>
      )}
      {flags && (
        <p className="rounded-lg bg-[var(--attention-tint)] px-3 py-2 text-xs text-[var(--attention)]">
          Style check: {flags}
        </p>
      )}
      {editable && !editing && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-2)]"
          >
            Edit
          </button>
          {onRegenerate && (
            <div className="space-y-2">
              <textarea
                value={steer}
                onChange={(e) => setSteer(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Steer the rewrite (optional) — e.g. shorter, mention their hiring post"
                aria-label="Steer the rewrite"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-sm placeholder:text-muted-foreground/60 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {regenerating ? "Regenerating…" : "Regenerate"}
              </button>
              {regenError && <p className="text-xs text-destructive">{regenError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

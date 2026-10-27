"use client";

import { ExternalLink, Radar } from "lucide-react";
import type { PeekPost, PeekSignal } from "../types";
import { Section } from "./section";

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

/** The Signals section — opened + scrolled to when the table's `+N` chip asks for it. */
export function SignalsSection({ signals, posts, focus }: { signals: PeekSignal[]; posts: PeekPost[]; focus: boolean }) {
  return (
    <Section id="signals" title="Signals" focus={focus}>
      <SignalsTimeline signals={signals} posts={posts} />
    </Section>
  );
}

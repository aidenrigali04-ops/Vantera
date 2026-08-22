"use client";

import Link from "next/link";
import { TopChrome } from "@/components/chrome";
import { TodayClient } from "@/app/(app)/today/today-client";
import { Wash } from "@/components/today";
import { PREVIEW_STATES, type PreviewStateKey } from "./fixtures";

const noop = async () => {};
const noopEngine = async () => ({});

/**
 * The design-review surface for Today (rule 07: a development-only artifact, never
 * user-facing). It mounts the REAL chrome and the REAL Today client against the
 * blueprint's sample cast, so every state can be read at 1440 and 390 without a
 * database. A switcher across the top swaps states; `?state=` deep-links one.
 */
export function PreviewClient({ state, tab }: { state: PreviewStateKey; tab: "queue" | "replies" | "activity" }) {
  const view = PREVIEW_STATES[state];
  return (
    <div className="app-surface relative min-h-screen bg-[var(--canvas)] pb-24 lg:pb-0">
      <Wash />
      <TopChrome
        workspaceName="Vantera"
        workspaceIconCandidates={["https://tryorin.xyz/favicon.ico", "https://tryorin.xyz/favicon.svg"]}
        paused={view.paused}
        badges={{ approvals: view.queue.total || undefined, inbox: view.replies.total || undefined }}
        notifications={[]}
        account={{ initial: "A", displayName: "Aiden Rigali", email: "aiden@vantera.test" }}
        signOut={noop}
        pauseEngine={noopEngine}
        resumeEngine={noopEngine}
      />
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-1.5 px-6 pt-4">
        {(Object.keys(PREVIEW_STATES) as PreviewStateKey[]).map((key) => (
          <Link
            key={key}
            href={`/today-preview?state=${key}`}
            className={`inline-flex h-7 items-center rounded-[var(--r-pill)] px-3 font-mono text-[12px] transition-colors ${
              key === state
                ? "bg-[var(--ink)] text-[var(--ink-fg)]"
                : "bg-[var(--surface)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {key}
          </Link>
        ))}
      </div>
      <TodayClient view={view} tab={tab} openDraftId={null} />
    </div>
  );
}

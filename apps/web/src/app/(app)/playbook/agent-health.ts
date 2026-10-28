/**
 * T4 operate path — the honest-status brain, shared by the agent card and the showcase
 * (plain module, NO "use client": both server pages and client components consume it).
 *
 * A "Live" label that can't distinguish working from stalled is a lie of omission — the
 * 2026-07-08 dead-scout incident idled for 11 days behind a green dot. These helpers turn
 * the recorded run history (agent_runs) + connection state into a user-facing reason.
 */

export type AgentRunRow = {
  agent_id: string;
  kind: "scout" | "intent";
  status: "completed" | "skipped" | "failed";
  summary: Record<string, unknown>;
  note: string | null;
  started_at: string;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Why a LIVE agent needs the owner's attention, or null when it's genuinely healthy.
 * Paused/draft agents never warn — their state is already explicit.
 */
export type Attention = { reason: string; cta: { label: string; href: string } } | null;

type AttentionInput = {
  kind: "scout" | "copy" | "intent";
  status: string;
  sendMode?: string | null;
  linkedinActive: number;
  lastRun: AgentRunRow | null;
};

const CONNECT = { label: "Connect LinkedIn", href: "/settings/senders" };

export function agentAttention(input: AttentionInput): Attention {
  const { kind, status, linkedinActive, lastRun } = input;
  if (status !== "live") return null;
  const runNow = { label: "Run now", href: `/playbook/${kind}` };

  if (kind === "copy") {
    if (linkedinActive === 0) {
      return {
        reason: "No LinkedIn account connected — approved messages can't send.",
        cta: CONNECT,
      };
    }
    return null;
  }

  if (!lastRun) return null;
  const s = lastRun.summary;

  if (kind === "intent") {
    if (lastRun.note === "no_connection" || s.reason === "no_connection") {
      return { reason: "No LinkedIn connection — connect it to start watching for intent.", cta: CONNECT };
    }
    if (lastRun.note === "empty_watchlist" || s.reason === "empty_watchlist") {
      return {
        reason: "The watchlist is empty — add keywords, competitors, or hashtags so the agent has something to watch.",
        cta: { label: "Edit watchlist", href: "/playbook/intent" },
      };
    }
    if (num(s.targets) > 0 && num(s.sourcingErrors) === num(s.targets)) {
      return {
        reason: "Every LinkedIn read failed on the last run — your connection likely needs a reconnect.",
        cta: { label: "Reconnect", href: "/settings/senders" },
      };
    }
  }

  if (lastRun.status === "failed") {
    return {
      reason: "The last run failed — it retries automatically, but if this repeats your config is worth a look.",
      cta: runNow,
    };
  }

  if (kind === "scout") {
    if (lastRun.note === "low_credits" || s.reason === "low_credits") {
      return {
        reason: "The last run paused on sourcing capacity — it resumes automatically.",
        cta: { label: "Check sourcing capacity", href: "/settings/billing" },
      };
    }
    if (s.reason === "trial_cap") {
      return {
        reason:
          "Sourcing is paused — this trial has reached its lead limit. Outreach can still use prospects already found.",
        cta: { label: "Pick a plan", href: "/settings/billing" },
      };
    }
    if (s.reason === "preview_full") {
      return { reason: "Sourcing is paused until a LinkedIn account is connected.", cta: CONNECT };
    }
    if (num(s.criteriaPending) > 0) {
      const n = num(s.criteriaPending);
      return {
        reason: `${n} ICP${n === 1 ? "" : "s"} couldn't be turned into a search yet — a more concrete description (industry, role, size) fixes it.`,
        cta: { label: "Edit ICPs", href: "/playbook/scout/edit" },
      };
    }
    if (num(s.discoveryTarget) > 0 && num(s.discovered) === 0) {
      return {
        reason: "The last run searched and found 0 prospects — your ICP may be too narrow for the source. Broadening it helps.",
        cta: runNow,
      };
    }
    if (num(s.rankErrors) > 0 && num(s.qualified) === 0 && num(s.gatePassed) > 0) {
      return {
        reason: "Scoring failed on the last run — qualified prospects weren't ranked. It retries automatically.",
        cta: runNow,
      };
    }
    return null;
  }

  return null;
}

/** Human reason for a skipped run's note code; null for unknown/absent notes (codes never surface). */
export function skipReason(note: string | null): string | null {
  if (note === "low_credits") return "sourcing capacity";
  if (note === "no_connection") return "no LinkedIn connection";
  if (note === "empty_watchlist") return "nothing on the watchlist";
  return null;
}

/** One human line per recorded run, e.g. "25 sourced → 20 passed gate → 5 qualified". */
export function runLine(run: AgentRunRow): string {
  if (run.status === "failed") return "Run failed — retried automatically";
  const s = run.summary;
  if (run.status === "skipped") {
    const reason = skipReason(run.note);
    return reason ? `Skipped — ${reason}` : "Skipped";
  }
  if (run.kind === "scout") {
    if (s.reason === "trial_cap") return "Sourcing paused — trial lead limit reached";
    if (s.reason === "pool_full") return "Sourcing paused — the qualified pool is full";
    if (s.reason === "preview_full") return "Sourcing paused — connect LinkedIn to keep finding prospects";
    const parked = num(s.criteriaPending);
    return (
      `${num(s.discovered)} sourced → ${num(s.gatePassed)} passed gate → ${num(s.qualified)} qualified` +
      (parked > 0 ? ` · ${parked} ICP${parked === 1 ? "" : "s"} parked` : "")
    );
  }
  return `${num(s.observed)} observed → ${num(s.intent)} showing intent → ${num(s.qualified)} qualified`;
}

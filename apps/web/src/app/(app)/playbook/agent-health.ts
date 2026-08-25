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
export function agentAttention(input: {
  kind: "scout" | "copy" | "intent";
  status: string;
  sendMode?: string | null;
  linkedinActive: number;
  lastRun: AgentRunRow | null;
}): string | null {
  const { kind, status, linkedinActive, lastRun } = input;
  if (status !== "live") return null;

  if (kind === "copy") {
    if (linkedinActive === 0) {
      return "No LinkedIn account connected — approved messages can't send. Connect it in Settings → LinkedIn.";
    }
    return null;
  }

  if (!lastRun) return null;
  const s = lastRun.summary;

  if (kind === "intent") {
    if (lastRun.note === "no_connection" || s.reason === "no_connection") {
      return "No LinkedIn connection — connect it in Settings → LinkedIn to start watching for intent.";
    }
    if (lastRun.note === "empty_watchlist" || s.reason === "empty_watchlist") {
      return "The watchlist is empty — add keywords, competitors, or hashtags so the agent has something to watch.";
    }
    if (num(s.targets) > 0 && num(s.sourcingErrors) === num(s.targets)) {
      return "Every LinkedIn read failed on the last run — your connection likely needs a reconnect.";
    }
  }

  if (lastRun.status === "failed") {
    return "The last run failed — it retries automatically, but if this repeats your config is worth a look.";
  }

  if (kind === "scout") {
    if (lastRun.note === "low_credits" || s.reason === "low_credits") {
      return "The last run paused on sourcing capacity — it resumes automatically.";
    }
    if (num(s.criteriaPending) > 0) {
      const n = num(s.criteriaPending);
      return `${n} ICP${n === 1 ? "" : "s"} couldn't be turned into a search yet — a more concrete description (industry, role, size) fixes it.`;
    }
    if (num(s.discoveryTarget) > 0 && num(s.discovered) === 0) {
      return "The last run searched and found 0 prospects — your ICP may be too narrow for the source. Broadening it helps.";
    }
    if (num(s.rankErrors) > 0 && num(s.qualified) === 0 && num(s.gatePassed) > 0) {
      return "Scoring failed on the last run — qualified prospects weren't ranked. It retries automatically.";
    }
    return null;
  }

  return null;
}

/** One human line per recorded run, e.g. "25 sourced → 20 passed gate → 5 qualified". */
export function runLine(run: AgentRunRow): string {
  if (run.status === "failed") return "Run failed — retried automatically";
  const s = run.summary;
  if (run.status === "skipped") {
    if (run.note === "low_credits") return "Skipped — sourcing capacity";
    if (run.note === "no_connection") return "Skipped — no LinkedIn connection";
    if (run.note === "empty_watchlist") return "Skipped — nothing on the watchlist";
    return "Skipped";
  }
  if (run.kind === "scout") {
    const parked = num(s.criteriaPending);
    return (
      `${num(s.discovered)} sourced → ${num(s.gatePassed)} passed gate → ${num(s.qualified)} qualified` +
      (parked > 0 ? ` · ${parked} ICP${parked === 1 ? "" : "s"} parked` : "")
    );
  }
  return `${num(s.observed)} observed → ${num(s.intent)} showing intent → ${num(s.qualified)} qualified`;
}

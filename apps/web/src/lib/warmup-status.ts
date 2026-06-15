// White-labeled warmup-status DTO + ready-in-days estimator.
// Pure helpers (estimateReadyInDays, shapeWarmupStatus) are unit-tested with no
// runtime deps. getWarmupStatus is the RLS-scoped async loader for server components
// and server actions — accountId always comes from the validated session, never a
// caller-supplied value (rule 02).
//
// The caller passes in the RLS-scoped Supabase server client (never the service-role
// client); accountId is an extra filter for explicitness, but RLS already scopes the
// rows to the session's account.

/** Standard warmup window used ONLY for the user-facing "~N days" estimate. */
const WARMUP_TARGET_DAYS = 21;

/**
 * Remaining calendar days until a mailbox is expected to be ready, based on a
 * 21-day warmup window. Returns null when the start date is unknown (no estimate
 * possible), and clamps to 0 once the window has elapsed.
 */
export function estimateReadyInDays(warmupStartedAt: Date | null, now: Date): number | null {
  if (!warmupStartedAt) return null;
  const elapsed = (now.getTime() - warmupStartedAt.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(WARMUP_TARGET_DAYS - elapsed));
}

export interface WarmupStatus {
  emailPhase: "warming" | "ready";
  /** Days until earliest warming mailbox is expected ready; 0 when all ready; null = unknown. */
  estReadyInDays: number | null;
  mailboxesReady: number;
  mailboxesTotal: number;
  linkedinConnected: boolean;
  channelsLiveNow: ("linkedin" | "email")[];
}

interface ShapeInput {
  mailboxes: { status: string; warmupStartedAt: Date | null }[];
  linkedinConnected: boolean;
  now: Date;
}

/**
 * Derives the WarmupStatus DTO from raw mailbox rows + LinkedIn connection state.
 * Pure and injectable-`now` so it is unit-testable without touching the DB.
 */
export function shapeWarmupStatus(i: ShapeInput): WarmupStatus {
  const ready = i.mailboxes.filter((m) => m.status === "active");
  const emailPhase =
    i.mailboxes.length > 0 && ready.length === i.mailboxes.length ? "ready" : "warming";
  const earliestWarming =
    i.mailboxes
      .filter((m) => m.status === "warming" && m.warmupStartedAt)
      .map((m) => m.warmupStartedAt as Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const channelsLiveNow: ("linkedin" | "email")[] = [];
  if (i.linkedinConnected) channelsLiveNow.push("linkedin");
  if (ready.length > 0) channelsLiveNow.push("email");
  return {
    emailPhase,
    estReadyInDays: emailPhase === "ready" ? 0 : estimateReadyInDays(earliestWarming, i.now),
    mailboxesReady: ready.length,
    mailboxesTotal: i.mailboxes.length,
    linkedinConnected: i.linkedinConnected,
    channelsLiveNow,
  };
}

/**
 * RLS-scoped WarmupStatus loader for server components and server actions.
 * accountId MUST come from the validated session — never a client-supplied value.
 * The caller passes in the RLS-scoped Supabase server client; using the service-role
 * client here would bypass RLS and violate rule 02.
 */
export async function getWarmupStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  accountId: string
): Promise<WarmupStatus> {
  const { data: mbxRows } = await supabase
    .from("mailboxes")
    .select("status, warmup_started_at")
    .eq("account_id", accountId)
    .in("status", ["warming", "active"]);

  const mailboxes = ((mbxRows ?? []) as Array<{ status: string; warmup_started_at: string | null }>).map((m) => ({
    status: m.status,
    warmupStartedAt: m.warmup_started_at ? new Date(m.warmup_started_at) : null,
  }));

  const { data: liRow } = await supabase
    .from("linkedin_accounts")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return shapeWarmupStatus({
    mailboxes,
    linkedinConnected: Boolean(liRow),
    now: new Date(),
  });
}

// White-labeled LinkedIn channel-status DTO + RLS-scoped loader.
// Vantera is LinkedIn-only — this replaces the former multi-channel warmup-status
// helper. getLinkedInChannelStatus is the RLS-scoped async loader for server
// components, server actions, and copilot read-tools; accountId always comes from
// the validated session, never a caller-supplied value (rule 02). The caller passes
// the RLS-scoped Supabase server client (never the service-role client).

export type LinkedInConnectionState =
  | "active"
  | "connecting"
  | "restricted"
  | "disconnected"
  | "off";

export interface LinkedInChannelStatus {
  /** At least one LinkedIn account is connected and active — outreach can send. */
  connected: boolean;
  /** State of the primary account (active first, else first connected, else "off"). */
  status: LinkedInConnectionState;
  /** LinkedIn accounts connected to the workspace. */
  accountCount: number;
}

const KNOWN_STATES: LinkedInConnectionState[] = [
  "active",
  "connecting",
  "restricted",
  "disconnected",
];

function toState(raw: string | null | undefined): LinkedInConnectionState {
  return KNOWN_STATES.includes(raw as LinkedInConnectionState)
    ? (raw as LinkedInConnectionState)
    : "off";
}

/**
 * RLS-scoped LinkedIn channel status. accountId MUST come from the validated session
 * — never a client-supplied value. Connecting your LinkedIn account is the single
 * activation gate now that LinkedIn is the only channel.
 */
export async function getLinkedInChannelStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  accountId: string
): Promise<LinkedInChannelStatus> {
  const { data: rows } = await supabase
    .from("linkedin_accounts")
    .select("status")
    .eq("account_id", accountId);

  const accounts = ((rows ?? []) as Array<{ status: string }>);
  const primary = accounts.find((a) => a.status === "active") ?? accounts[0];
  return {
    connected: accounts.some((a) => a.status === "active"),
    status: toState(primary?.status),
    accountCount: accounts.length,
  };
}

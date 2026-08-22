import type { ConnectedAccount, LinkedInInfra } from "@vantera/linkedin-infra";
import { normalizeLinkedInUrl } from "./copy-draft";

// LinkedIn connection health reconcile — the durable fix for the 2026-07-06 invisible
// disconnect: LinkedIn killed a session, the provider never sent a status webhook, our row
// stayed 'active', and for two days every send failed, every intent read 401'd, and every
// inbound reply was lost — with zero user-facing signal. This cron treats the provider's
// live account list as the truth and reconciles our rows against it, so a dead connection
// (a) quiesces the pipeline via the existing status='active' filters and (b) surfaces to
// the user (dashboard banner reads the status; a transition alert emails the admins).
//
// It is also the duplicate-seat janitor (2026-07-08 follow-up incident): a reconnect that
// minted a fresh provider account left the tenant with several rows + billable seats for
// ONE human. The sweep merges same-identity rows onto the row that carries the lead
// history, points it at the live connection, and deletes the superseded provider seats.

export interface LinkedInAccountRow {
  id: string;
  accountId: string;
  providerRef: string;
  status: "connecting" | "active" | "restricted" | "disconnected";
  profileUrl: string | null;
  createdAt: Date;
  /** leads whose sequences are stuck to this sender — drives keeper choice in a merge */
  assignedLeads: number;
}

export interface AccountHealthStore {
  listLinkedInAccounts(): Promise<LinkedInAccountRow[]>;
  /** Reconcile one row to the provider's live status. Moving TO 'active' restarts the
   *  rule-04 ramp clock (connected_at), same contract as the status webhook upsert. */
  setLinkedInAccountStatus(id: string, status: "active" | "restricted" | "disconnected"): Promise<void>;
  /** Merge support: move lead assignments + send history from duplicate rows to the keeper. */
  reassignSenderHistory(fromIds: string[], toId: string): Promise<void>;
  deleteLinkedInAccountRows(ids: string[]): Promise<void>;
  /** Point the keeper row at the LIVE provider connection (status active, ramp clock reset). */
  repointLinkedInAccount(id: string, providerRef: string): Promise<void>;
  /** Owner + admin emails for the tenant — the disconnect alert's recipients. */
  getAccountAdminEmails(accountId: string): Promise<string[]>;
}

export interface HealthAlert {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface AccountHealthDeps {
  store: AccountHealthStore;
  linkedin: Pick<LinkedInInfra, "listAccounts" | "deleteConnectedAccount">;
  send: (alert: HealthAlert) => Promise<void>;
  appUrl: string;
}

export interface AccountHealthSummary {
  status: "completed" | "skipped";
  checked: number;
  reconciled: number;
  alerted: number;
  /** duplicate same-identity rows merged away (seat cleanup) */
  merged: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The "your agents are paused" alert — white-label, action-first (no vendor names, rule 04). */
export function buildDisconnectAlert(to: string, appUrl: string): HealthAlert {
  const link = `${appUrl}/settings/senders`;
  const text = [
    "Your LinkedIn connection needs attention.",
    "",
    "LinkedIn ended the session behind your connected account, so your agents are paused:",
    "no new prospects, no outreach, and replies aren't coming in until it's reconnected.",
    "",
    `Reconnect in a minute here: ${link}`,
    "",
    "Everything resumes automatically once the connection is back.",
  ].join("\n");
  const html = [
    `<p><strong>Your LinkedIn connection needs attention.</strong></p>`,
    `<p>LinkedIn ended the session behind your connected account, so your agents are paused — no new prospects, no outreach, and replies aren't coming in until it's reconnected.</p>`,
    `<p><a href="${esc(link)}">Reconnect your LinkedIn account</a> — it takes about a minute, and everything resumes automatically.</p>`,
  ].join("\n");
  return { to, subject: "Action needed: your LinkedIn connection is paused", html, text };
}

const identityKey = (row: LinkedInAccountRow): string | null =>
  row.profileUrl ? `${row.accountId}|${normalizeLinkedInUrl(row.profileUrl)}` : null;

/**
 * One reconcile tick. One provider list call covers every tenant; a row the provider no
 * longer holds at all is 'disconnected'. Alerts fire only on the healthy→unhealthy
 * TRANSITION (a persistently dead account never re-alerts every tick), and an alert
 * failure never blocks the status write — the banner is the fallback signal.
 */
export async function runAccountHealth(deps: AccountHealthDeps): Promise<AccountHealthSummary> {
  const rows = await deps.store.listLinkedInAccounts();
  if (rows.length === 0) return { status: "skipped", checked: 0, reconciled: 0, alerted: 0, merged: 0 };

  let provider: ConnectedAccount[];
  try {
    provider = await deps.linkedin.listAccounts();
  } catch {
    // Can't reach the provider — reconciling everything to 'disconnected' on a transient
    // outage would pause healthy tenants. Do nothing; the next tick retries.
    return { status: "skipped", checked: rows.length, reconciled: 0, alerted: 0, merged: 0 };
  }
  const liveByRef = new Map(provider.map((a) => [a.providerRef, a.status]));

  // ── Duplicate-seat sweep ────────────────────────────────────────────────────
  // Same tenant + same human under several rows/refs. Keeper = the row carrying the
  // lead history (most assigned, tie oldest); it is pointed at the LIVE connection and
  // every other seat in the group is deleted, provider-side included.
  const groups = new Map<string, LinkedInAccountRow[]>();
  for (const row of rows) {
    const key = identityKey(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let merged = 0;
  const removedIds = new Set<string>();
  // Post-merge state per keeper — the reconcile below must judge the row as it now IS,
  // not as it was listed (input rows are never mutated).
  const mergedState = new Map<string, { providerRef: string; status: LinkedInAccountRow["status"] }>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keeper = [...group].sort(
      (a, b) => b.assignedLeads - a.assignedLeads || a.createdAt.getTime() - b.createdAt.getTime()
    )[0]!;
    const dups = group.filter((r) => r.id !== keeper.id);
    const groupRefs = new Set(group.map((r) => r.providerRef));

    // The connection to keep: the keeper's own if the provider says it's live, else the
    // newest live sibling connection. All dead → keeper keeps its ref; reconcile flags it.
    const liveRef =
      liveByRef.get(keeper.providerRef) === "active"
        ? keeper.providerRef
        : ([...group]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .find((r) => liveByRef.get(r.providerRef) === "active")?.providerRef ?? null);

    await deps.store.reassignSenderHistory(dups.map((d) => d.id), keeper.id);
    await deps.store.deleteLinkedInAccountRows(dups.map((d) => d.id));
    for (const d of dups) removedIds.add(d.id);
    let keeperRef = keeper.providerRef;
    if (liveRef && liveRef !== keeper.providerRef) {
      await deps.store.repointLinkedInAccount(keeper.id, liveRef);
      keeperRef = liveRef;
      mergedState.set(keeper.id, { providerRef: liveRef, status: "active" });
    }
    for (const ref of groupRefs) {
      if (ref === keeperRef) continue;
      try {
        await deps.linkedin.deleteConnectedAccount(ref); // stop billing the superseded seat
      } catch {
        // best-effort; retried next tick (the ref will still be absent from our rows,
        // but a re-listed group won't reform — deletion here is purely seat hygiene)
      }
    }
    merged += dups.length;
  }

  // ── Status reconcile on the surviving rows ─────────────────────────────────
  let reconciled = 0;
  let alerted = 0;
  for (const listed of rows) {
    if (removedIds.has(listed.id)) continue;
    const row = { ...listed, ...(mergedState.get(listed.id) ?? {}) };
    if (row.status === "connecting") continue; // mid-flow — the webhook/backstop owns this state
    const live = liveByRef.get(row.providerRef) ?? "disconnected";
    if (live === row.status) continue;

    await deps.store.setLinkedInAccountStatus(row.id, live);
    reconciled += 1;

    if (row.status === "active" && live !== "active") {
      const emails = await deps.store.getAccountAdminEmails(row.accountId);
      for (const to of emails) {
        try {
          await deps.send(buildDisconnectAlert(to, deps.appUrl));
          alerted += 1;
        } catch {
          // alert is best-effort; the reconciled status still drives the in-app banner
        }
      }
    }
  }

  return { status: "completed", checked: rows.length, reconciled, alerted, merged };
}

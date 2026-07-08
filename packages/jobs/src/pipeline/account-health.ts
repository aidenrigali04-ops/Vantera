import type { ConnectedAccount, LinkedInInfra } from "@vantera/linkedin-infra";

// LinkedIn connection health reconcile — the durable fix for the 2026-07-06 invisible
// disconnect: LinkedIn killed a session, the provider never sent a status webhook, our row
// stayed 'active', and for two days every send failed, every intent read 401'd, and every
// inbound reply was lost — with zero user-facing signal. This cron treats the provider's
// live account list as the truth and reconciles our rows against it, so a dead connection
// (a) quiesces the pipeline via the existing status='active' filters and (b) surfaces to
// the user (dashboard banner reads the status; a transition alert emails the admins).

export interface LinkedInAccountRow {
  id: string;
  accountId: string;
  providerRef: string;
  status: "active" | "restricted" | "disconnected";
}

export interface AccountHealthStore {
  listLinkedInAccounts(): Promise<LinkedInAccountRow[]>;
  /** Reconcile one row to the provider's live status. Moving TO 'active' restarts the
   *  rule-04 ramp clock (connected_at), same contract as the status webhook upsert. */
  setLinkedInAccountStatus(id: string, status: LinkedInAccountRow["status"]): Promise<void>;
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
  linkedin: Pick<LinkedInInfra, "listAccounts">;
  send: (alert: HealthAlert) => Promise<void>;
  appUrl: string;
}

export interface AccountHealthSummary {
  status: "completed" | "skipped";
  checked: number;
  reconciled: number;
  alerted: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The "your agents are paused" alert — white-label, action-first (no vendor names, rule 04). */
export function buildDisconnectAlert(to: string, appUrl: string): HealthAlert {
  const link = `${appUrl}/settings/channels`;
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

/**
 * One reconcile tick. One provider list call covers every tenant; a row the provider no
 * longer holds at all is 'disconnected'. Alerts fire only on the healthy→unhealthy
 * TRANSITION (a persistently dead account never re-alerts every tick), and an alert
 * failure never blocks the status write — the banner is the fallback signal.
 */
export async function runAccountHealth(deps: AccountHealthDeps): Promise<AccountHealthSummary> {
  const rows = await deps.store.listLinkedInAccounts();
  if (rows.length === 0) return { status: "skipped", checked: 0, reconciled: 0, alerted: 0 };

  let provider: ConnectedAccount[];
  try {
    provider = await deps.linkedin.listAccounts();
  } catch {
    // Can't reach the provider — reconciling everything to 'disconnected' on a transient
    // outage would pause healthy tenants. Do nothing; the next tick retries.
    return { status: "skipped", checked: rows.length, reconciled: 0, alerted: 0 };
  }
  const liveByRef = new Map(provider.map((a) => [a.providerRef, a.status]));

  let reconciled = 0;
  let alerted = 0;
  for (const row of rows) {
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

  return { status: "completed", checked: rows.length, reconciled, alerted };
}

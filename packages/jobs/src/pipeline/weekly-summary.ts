// Weekly summary email — the retention lever the market research ranked #2:
// auto-sent summaries beat dashboards ("most clients don't log in"). Pure core
// (rule 13): stats arrive via the store interface, the mailer is injected; the
// drizzle implementation lives in pg-store, Resend behind @vantera/transactional-email.
//
// This is a product notification to the account's own team — never cold outreach —
// so rule 11's suppression gate does not apply (same lane as invite emails). The
// opt-out is accounts.weekly_summary_enabled (0042), honored here AND surfaced in
// Settings; a dead week (zero activity, no live agents) sends nothing at all.

export interface WeeklySummaryRow {
  accountId: string;
  accountName: string;
  weeklySummaryEnabled: boolean;
  liveAgents: number;
  /** LinkedIn touches sent in the window */
  sent: number;
  replies: number;
  /** meetings booked (leads converted) in the window */
  meetings: number;
  /** in-market leads the Intent Agent surfaced in the window */
  intentLeads: number;
  /** leads that cleared the qualification bar in the window */
  qualified: number;
  /** active pipeline × avg deal value; null until a deal value is set */
  pipelineValueCents: number | null;
  goalCents: number | null;
  /** owner + admin emails */
  recipients: string[];
}

export interface WeeklySummaryStore {
  /** per-account stats for the 7-day window ending at `end` */
  listAccountsForSummary(start: Date, end: Date): Promise<WeeklySummaryRow[]>;
  /** Feeds the pull-back collision guard (spec 2026-07-18). Optional so tests need not stub it. */
  stampLifecycleEmail?(accountId: string, at: Date): Promise<void>;
}

export interface WeeklySummaryMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface WeeklySummaryDeps {
  store: WeeklySummaryStore;
  send: (message: WeeklySummaryMessage) => Promise<void>;
  /** absolute app origin for links, e.g. https://www.vanterasystem.dev */
  appUrl: string;
  now?: () => Date;
}

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Outcome-first subject: replies + meetings are what the user actually wants. */
function subjectFor(row: WeeklySummaryRow, quiet: boolean): string {
  if (quiet) return "Your agents this week";
  const parts: string[] = [];
  if (row.replies > 0) parts.push(plural(row.replies, "reply").replace("replys", "replies"));
  if (row.meetings > 0) parts.push(`${plural(row.meetings, "meeting")} booked`);
  if (parts.length === 0) {
    if (row.qualified > 0) parts.push(`${row.qualified} qualified leads`);
    else parts.push(`${plural(row.sent, "touch")} sent`);
  }
  return `Your agents this week: ${parts.join(", ")}`;
}

function statRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:#444">${label}</td>
    <td style="padding:8px 0;font-size:14px;font-weight:600;color:#111;text-align:right;font-variant-numeric:tabular-nums">${value}</td>
  </tr>`;
}

/**
 * Compose one account's summary, or null when no email should go out: opted out,
 * nobody to send to, or a dead week (zero activity AND no live agents). A quiet
 * week with live agents still sends — silence reads as "is it even on?".
 */
export function composeWeeklySummary(
  row: WeeklySummaryRow,
  appUrl: string
): Omit<WeeklySummaryMessage, "to"> | null {
  if (!row.weeklySummaryEnabled) return null;
  if (row.recipients.length === 0) return null;

  const activity = row.sent + row.replies + row.meetings + row.intentLeads + row.qualified;
  if (activity === 0 && row.liveAgents === 0) return null;
  const quiet = activity === 0;

  const name = esc(row.accountName);
  const subject = subjectFor(row, quiet);

  const stats: string[] = [];
  if (!quiet) {
    stats.push(statRow("Outreach sent", String(row.sent)));
    stats.push(statRow("Replies", String(row.replies)));
    stats.push(statRow("Meetings booked", String(row.meetings)));
    if (row.intentLeads > 0) stats.push(statRow("In-market leads surfaced", String(row.intentLeads)));
    stats.push(statRow("Leads qualified", String(row.qualified)));
    if (row.pipelineValueCents != null && row.pipelineValueCents > 0) {
      stats.push(
        statRow(
          "Pipeline value",
          row.goalCents
            ? `${usd(row.pipelineValueCents)} toward ${usd(row.goalCents)}/mo`
            : usd(row.pipelineValueCents)
        )
      );
    }
  }

  const intro = quiet
    ? `A quiet week — your ${plural(row.liveAgents, "agent")} stayed on schedule, and nothing needed you. New prospects and replies will be in next week's summary the moment they land.`
    : `Here's what your agents did for ${name} this week.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:sans-serif;background:#fff;color:#111;margin:0;padding:40px 24px">
  <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#888">Weekly summary</p>
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">${esc(subject.replace("Your agents this week: ", "This week: ").replace("Your agents this week", "This week"))}</h1>
  <p style="margin:0 0 20px;font-size:15px;color:#444">${intro}</p>
  ${
    stats.length > 0
      ? `<table style="width:100%;max-width:420px;border-collapse:collapse;border-top:1px solid #eee">${stats.join("")}</table>`
      : ""
  }
  <a href="${appUrl}/dashboard"
     style="display:inline-block;margin-top:24px;background:#111;color:#fff;text-decoration:none;
            padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600">
    Open your dashboard
  </a>
  <p style="margin:28px 0 0;font-size:12px;color:#888">
    You get this once a week because your workspace has agents set up.
    Turn it off any time in <a href="${appUrl}/settings" style="color:#888">Settings</a>.
  </p>
</body>
</html>`.trim();

  const textLines = quiet
    ? [subject, "", intro]
    : [
        subject,
        "",
        intro,
        "",
        `Outreach sent: ${row.sent}`,
        `Replies: ${row.replies}`,
        `Meetings booked: ${row.meetings}`,
        ...(row.intentLeads > 0 ? [`In-market leads surfaced: ${row.intentLeads}`] : []),
        `Leads qualified: ${row.qualified}`,
        ...(row.pipelineValueCents != null && row.pipelineValueCents > 0
          ? [`Pipeline value: ${usd(row.pipelineValueCents)}`]
          : []),
      ];
  textLines.push("", `Open your dashboard: ${appUrl}/dashboard`, "", `Turn weekly summaries off in Settings: ${appUrl}/settings`);

  return { subject, html, text: textLines.join("\n") };
}

export interface WeeklySummaryOutcome {
  accounts: number;
  emailed: number;
  skipped: number;
  failures: number;
}

export async function runWeeklySummary(deps: WeeklySummaryDeps): Promise<WeeklySummaryOutcome> {
  const now = deps.now?.() ?? new Date();
  const start = new Date(now.getTime() - 7 * 86_400_000);
  const rows = await deps.store.listAccountsForSummary(start, now);

  const outcome: WeeklySummaryOutcome = {
    accounts: rows.length,
    emailed: 0,
    skipped: 0,
    failures: 0,
  };

  for (const row of rows) {
    const message = composeWeeklySummary(row, deps.appUrl);
    if (!message) {
      outcome.skipped++;
      continue;
    }
    try {
      for (const to of row.recipients) {
        await deps.send({ to, ...message });
      }
      outcome.emailed++;
      await deps.store.stampLifecycleEmail?.(row.accountId, now);
    } catch {
      // One account's provider hiccup never blocks the rest; next Monday catches up.
      outcome.failures++;
    }
  }

  return outcome;
}

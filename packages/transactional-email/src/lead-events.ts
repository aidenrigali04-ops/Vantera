import { createTransactionalEmailFromEnv } from "./resend";

export type LeadEventKind = "interested_reply" | "meeting_booked" | "needs_human";

export interface LeadEventEmailOptions {
  to: string;
  kind: LeadEventKind;
  /** prospect display name ("Dana Reed at Acme") */
  leadName: string;
  /** short snippet — the reply text or event detail (already truncated by the caller) */
  snippet: string;
  /** absolute deep link to the exact thread/page */
  url: string;
}

const SUBJECT: Record<LeadEventKind, (name: string) => string> = {
  interested_reply: (n) => `${n} replied — they're interested`,
  meeting_booked: (n) => `${n} booked a meeting`,
  needs_human: (n) => `${n} needs you — Vera handed the thread over`,
};

const LEAD_LINE: Record<LeadEventKind, string> = {
  interested_reply:
    "A warm reply just landed. Vera has a draft ready — read it and jump in while they're engaged.",
  meeting_booked:
    "A meeting was booked from your outreach. Outreach to this prospect has stood down automatically.",
  needs_human:
    "Vera hit its conversation limit on a live thread — this one needs a human to bring it home.",
};

const CTA: Record<LeadEventKind, string> = {
  interested_reply: "Open the conversation",
  meeting_booked: "See your meetings",
  needs_human: "Take over the thread",
};

/**
 * Moment-of-value emails (L3, spec 2026-07-15): the three events worth interrupting someone
 * for, sent the moment they happen. Copy is honest and pronoun-free for Vera; the snippet is
 * the prospect's real words, never a fabrication.
 */
export async function sendLeadEventEmail(opts: LeadEventEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const subject = SUBJECT[opts.kind](opts.leadName);
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:sans-serif;background:#fff;color:#111;margin:0;padding:40px 24px">
  <h1 style="font-size:19px;font-weight:700;margin:0 0 12px">${subject}</h1>
  <p style="margin:0 0 16px;font-size:15px;color:#444">${LEAD_LINE[opts.kind]}</p>
  ${
    opts.snippet
      ? `<blockquote style="margin:0 0 20px;padding:12px 16px;background:#f6f8fb;border-left:3px solid #1877f2;font-size:14px;color:#333">${opts.snippet}</blockquote>`
      : ""
  }
  <a href="${opts.url}"
     style="display:inline-block;background:#111;color:#fff;text-decoration:none;
            padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600">
    ${CTA[opts.kind]}
  </a>
  <p style="margin:24px 0 0;font-size:12px;color:#888">
    You can turn these emails off in Settings → Notifications.
  </p>
</body>
</html>`.trim();

  const text = [subject, "", LEAD_LINE[opts.kind], opts.snippet ? `\n"${opts.snippet}"\n` : "", `${CTA[opts.kind]}: ${opts.url}`]
    .join("\n")
    .trim();

  await mailer.send({ to: opts.to, subject, html, text });
}

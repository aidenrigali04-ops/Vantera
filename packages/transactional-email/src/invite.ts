import { createTransactionalEmailFromEnv } from "./resend";

export interface InviteEmailOptions {
  to: string;
  inviteUrl: string;
  workspaceName: string;
}

/**
 * Send a team-invite transactional email.
 * Uses createTransactionalEmailFromEnv() — requires RESEND_API_KEY and RESEND_FROM_EMAIL.
 */
export async function sendInviteEmail(opts: InviteEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:sans-serif;background:#fff;color:#111;margin:0;padding:40px 24px">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">You've been invited to join ${opts.workspaceName}</h1>
  <p style="margin:0 0 24px;font-size:15px;color:#444">
    You have been invited to collaborate on <strong>${opts.workspaceName}</strong>.
    Accept the invitation to get started.
  </p>
  <a href="${opts.inviteUrl}"
     style="display:inline-block;background:#111;color:#fff;text-decoration:none;
            padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600">
    Accept invitation
  </a>
  <p style="margin:24px 0 0;font-size:13px;color:#888">
    This link expires in 7 days. If you weren't expecting this email, you can safely ignore it.
  </p>
</body>
</html>`.trim();

  const text = [
    `You've been invited to join ${opts.workspaceName}.`,
    "",
    `Accept your invitation: ${opts.inviteUrl}`,
    "",
    "This link expires in 7 days. If you weren't expecting this email, you can safely ignore it.",
  ].join("\n");

  await mailer.send({
    to: opts.to,
    subject: `You're invited to join ${opts.workspaceName} on Vantera`,
    html,
    text,
  });
}

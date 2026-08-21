import { createTransactionalEmailFromEnv } from "./resend";

export interface StartResumeEmailOptions {
  to: string;
  /** /auth/confirm magic-link URL — signs the recipient in and fast-forwards /start. */
  resumeUrl: string;
}

/**
 * "Pick up where you left off" — the claim step's background sign-in link (journey v2).
 * Doubles as device recovery AND implicit address verification for the passwordless
 * claim path. Product notification, never outreach (this package's scope contract).
 */
export async function sendStartResumeEmail(opts: StartResumeEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:sans-serif;background:#fff;color:#111;margin:0;padding:40px 24px">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">Pick up where you left off</h1>
  <p style="margin:0 0 24px;font-size:15px;color:#444">
    Your Vantera workspace is waiting. This link signs you in on any device and takes you
    straight back to building your pipeline.
  </p>
  <a href="${opts.resumeUrl}"
     style="display:inline-block;background:#1877f2;color:#fff;text-decoration:none;
            padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600">
    Continue setting up
  </a>
  <p style="margin:24px 0 0;font-size:13px;color:#888">
    If you weren't expecting this email, you can safely ignore it.
  </p>
</body>
</html>`.trim();

  const text = [
    "Pick up where you left off.",
    "",
    `Continue setting up: ${opts.resumeUrl}`,
    "",
    "If you weren't expecting this email, you can safely ignore it.",
  ].join("\n");

  await mailer.send({ to: opts.to, subject: "Your Vantera workspace is waiting", html, text });
}

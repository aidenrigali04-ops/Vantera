export interface RawMessage { to: string; subject: string; body: string; headers: Record<string, string> }
export interface GmailSendResult { messageId: string }

/** Sends via Gmail API as a specific mailbox (userId = its email address). */
export interface GmailSender {
  sendRaw(fromAddress: string, msg: RawMessage): Promise<GmailSendResult>;
}

export class InMemoryGmailSender implements GmailSender {
  readonly sent: Array<{ from: string } & RawMessage> = [];
  private counter = 0;
  async sendRaw(fromAddress: string, msg: RawMessage): Promise<GmailSendResult> {
    this.sent.push({ from: fromAddress, ...msg });
    return { messageId: `gmsg_${++this.counter}` };
  }
}

export interface GoogleGmailConfig { getAccessToken: () => Promise<string>; fetchFn?: typeof fetch; baseUrl?: string }

export class GoogleGmailSender implements GmailSender {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: GoogleGmailConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://gmail.googleapis.com/gmail/v1";
  }
  async sendRaw(fromAddress: string, msg: RawMessage): Promise<GmailSendResult> {
    const headerLines = [
      `From: ${fromAddress}`,
      `To: ${msg.to}`,
      `Subject: ${msg.subject}`,
      ...Object.entries(msg.headers).map(([k, v]) => `${k}: ${v}`),
      "Content-Type: text/html; charset=UTF-8",
    ].join("\r\n");
    const mime = `${headerLines}\r\n\r\n${msg.body}`;
    const raw = Buffer.from(mime).toString("base64url");
    // NOTE: fromAddress is used raw (not encodeURIComponent'd) so the URL contains the literal
    // address with @ — required by the Gmail API userId format and the test assertion.
    const res = await this.fetchFn(`${this.base}/users/${fromAddress}/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.cfg.getAccessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) throw new Error(`gmail send failed from ${fromAddress}: ${res.status}`);
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error("gmail send response missing id");
    return { messageId: data.id };
  }
}

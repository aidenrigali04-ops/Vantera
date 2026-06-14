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

import type {
  TransactionalEmail,
  TransactionalMessage,
  TransactionalSendResult,
} from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryTransactionalEmail implements TransactionalEmail {
  readonly sent: TransactionalMessage[] = [];
  private counter = 0;

  async send(message: TransactionalMessage): Promise<TransactionalSendResult> {
    if (!message.to.includes("@")) throw new Error(`invalid recipient: ${message.to}`);
    if (message.subject === "") throw new Error("subject required");
    this.sent.push(message);
    return { messageId: `mem_${++this.counter}` };
  }
}

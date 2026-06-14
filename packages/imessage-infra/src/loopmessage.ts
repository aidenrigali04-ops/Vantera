import type { MessageInfra } from "./types";

/** Real provider is deferred (Non-Goal). This stub keeps the factory total. */
export class LoopMessageInfra implements MessageInfra {
  async sendMessage(): Promise<never> {
    throw new Error("iMessage provider not configured (IMESSAGE_PROVIDER=loopmessage is stubbed)");
  }
  verifyWebhook(): boolean {
    return false;
  }
  parseEventWebhook(): null {
    return null;
  }
}

import { InMemoryMessageInfra } from "./in-memory";

/** Single env factory (mirrors createVoiceInfraFromEnv). Defaults to the in-memory fake. */
export function createMessageInfraFromEnv(env: Record<string, string | undefined> = process.env): MessageInfra {
  if (env.IMESSAGE_PROVIDER === "loopmessage") return new LoopMessageInfra();
  return new InMemoryMessageInfra(env.IMESSAGE_WEBHOOK_SECRET ?? "in-memory-secret");
}

import type { Db } from "@vantera/db";
import {
  composeMessage,
  fixConversationMessage,
  judgeCopy,
  readTurn,
  shortlistMoves,
} from "@vantera/agent-brains";
import { createConversationStore } from "./pg-store";
import type { InboundDeps, InboundStore, ResponderBundle } from "./types";

/**
 * The real conversation-intelligence wiring for the inbound wrappers (process-inbound, replay-inbound,
 * thread-sync): reads the `conversation_policy` rollout knob once per run and binds the brains + the
 * conversation store over the inbound store. A failed knob read degrades to "off" — today's path,
 * byte-identical — never a blocked inbound run. The seller name comes from the bundle in the core.
 */
export async function buildConversationDeps(
  db: Db,
  store: InboundStore,
  bestOfN: number
): Promise<NonNullable<InboundDeps["conversation"]>> {
  const conversationStore = createConversationStore(db);
  const mode = await conversationStore.getConversationPolicyMode().catch(() => "off" as const);
  return {
    mode,
    deps: {
      store: { ...store, ...conversationStore },
      readFn: readTurn,
      shortlistFn: shortlistMoves,
      composeFn: composeMessage,
      fixFn: (draft, input) => fixConversationMessage(draft, input),
      judgeFn: judgeCopy,
      bestOfN,
      now: () => new Date(),
      rng: Math.random,
      seed: () => Math.floor(Math.random() * 2 ** 31),
    },
  };
}

/**
 * The seller name the composer signs as: an explicit override (null included) wins, else the
 * bundle's account name. Shared by every conversation-core caller (inbound, sequence-touch).
 */
export function sellerNameFor(bundle: ResponderBundle, override?: string | null): string | null {
  return override !== undefined ? override : (bundle.context.accountName ?? null);
}

import { asc, eq, gt, and } from "drizzle-orm";
import { logger, task } from "@trigger.dev/sdk";
import { createDb, webhookEvents } from "@vantera/db";
import {
  classifyReply,
  draftConversationMessage,
  fixConversationMessage,
  judgeCopy,
} from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runInbound } from "../pipeline/inbound";
import { createPgStore } from "../pipeline/pg-store";

/**
 * Ops replay: re-run stored webhook_events through the SAME inbound pipeline as
 * process-inbound. Every inbound event is persisted before processing (the route's
 * recordEvent step), so any matching/processing bug can be recovered from by replaying —
 * first used 2026-07-05 to backfill the replies+acceptances the provider-id matching bug
 * dropped. Safe to re-run: replies dedupe on provider_message_ref (0043), lead-state
 * writes are idempotent stamps, and the responder skips leads with a queued message.
 *
 * Trigger manually with { since?: ISO, limit?: number } — never scheduled.
 */
export const replayInbound = task({
  id: "replay-inbound",
  maxDuration: 1800,
  run: async (payload: { since?: string; limit?: number }) => {
    const db = createDb();
    const store = createPgStore(db);
    // Phase 2C fast-follow (best-of-N on the responder paths): mirrors process-inbound.ts —
    // same pipeline, same config knob, so a replay behaves identically to live processing.
    const bestOfN = await store.getBestOfN();
    const deps = {
      store,
      linkedinInfra: createLinkedInInfraFromEnv(),
      classifyFn: (body: string) => classifyReply(body),
      respondFn: draftConversationMessage,
      fixReplyFn: fixConversationMessage,
      judgeFn: judgeCopy,
      bestOfN,
    };

    const rows = await db
      .select({ id: webhookEvents.id, payload: webhookEvents.payload, receivedAt: webhookEvents.receivedAt })
      .from(webhookEvents)
      .where(
        payload.since
          ? and(eq(webhookEvents.source, "linkedin"), gt(webhookEvents.receivedAt, new Date(payload.since)))
          : eq(webhookEvents.source, "linkedin")
      )
      .orderBy(asc(webhookEvents.receivedAt))
      .limit(payload.limit ?? 500);

    const outcomes: Record<string, number> = {};
    for (const row of rows) {
      try {
        const summary = await runInbound({ source: "linkedin", payload: row.payload }, deps);
        outcomes[summary.action] = (outcomes[summary.action] ?? 0) + 1;
      } catch (err) {
        outcomes.error = (outcomes.error ?? 0) + 1;
        logger.error("replay event failed", {
          eventId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("replay finished", { events: rows.length, outcomes });
    return { events: rows.length, outcomes };
  },
});

import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import type { MeetingEvent } from "@vantera/meetings-infra";
import { runMeetingEvent } from "../pipeline/meeting-event";
import { createPgStore } from "../pipeline/pg-store";

/** ML-6: apply one verified scheduling-tool delivery (enqueued by the meetings webhook route). */
export const processMeetingEvent = task({
  id: "process-meeting-event",
  retry: { maxAttempts: 3 },
  run: async (payload: { connectionId: string; event: Omit<MeetingEvent, "startAt"> & { startAt: string | null } }) => {
    // Trigger payloads are JSON — revive the start time
    const event: MeetingEvent = { ...payload.event, startAt: payload.event.startAt ? new Date(payload.event.startAt) : null };
    const result = await runMeetingEvent({ connectionId: payload.connectionId, event }, { store: createPgStore(createDb()) });
    logger.info("meeting event processed", { connectionId: payload.connectionId, kind: event.kind, ...result });
    return result;
  },
});

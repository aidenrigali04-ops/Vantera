import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { runSendDispatch } from "../pipeline/send-dispatch";
import { createPgStore } from "../pipeline/pg-store";

/** The send gatekeeper cron (rules 04/11): kill switch, caps, pacing — then fan-out. */
export const sendDispatch = schedules.task({
  id: "send-dispatch",
  cron: "*/5 * * * *",
  run: async () => {
    const store = createPgStore(createDb());
    const summary = await runSendDispatch({
      store,
      enqueue: async (sendId, runAt) => {
        await tasks.trigger("outreach-send", { sendId }, { delay: runAt });
      },
    });
    logger.info("send dispatch tick", { ...summary });
    return summary;
  },
});

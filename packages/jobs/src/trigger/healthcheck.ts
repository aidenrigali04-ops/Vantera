import { logger, task } from "@trigger.dev/sdk";

/** Smoke task: proves the jobs package deploys and runs. */
export const healthcheck = task({
  id: "healthcheck",
  run: async (payload: { note?: string }) => {
    logger.info("vantera jobs healthcheck", { note: payload.note ?? "ok" });
    return { ok: true as const };
  },
});

import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import type { ProviderAlertDeps } from "./provider-alert";
import type { AppSettingsStore } from "./types";

/** Wires the live ops mailer for withProviderAlert. Recipient: OPS_ALERT_EMAIL (no prospect data is sent). */
export function buildProviderAlertDeps(store: AppSettingsStore): ProviderAlertDeps {
  return {
    store,
    now: () => new Date(),
    send: async ({ subject, body }) => {
      const to = process.env.OPS_ALERT_EMAIL;
      if (!to) throw new Error("OPS_ALERT_EMAIL not set");
      await createTransactionalEmailFromEnv().send({ to, subject, html: `<p>${body}</p>`, text: body });
    },
  };
}

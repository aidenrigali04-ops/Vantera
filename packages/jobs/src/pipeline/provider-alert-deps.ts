import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import { LIFECYCLE_ADMIN_EMAIL } from "./lifecycle-outreach";
import type { ProviderAlertDeps } from "./provider-alert";
import type { AppSettingsStore } from "./types";

/** Wires the live ops mailer for withProviderAlert. Recipient: the platform admin
 *  (LIFECYCLE_ADMIN_EMAIL, the same operator identity the lifecycle/trial-cap paths use);
 *  account-health's per-tenant admin list is not applicable to a platform-wide AI outage.
 *  No prospect data is sent. */
export function buildProviderAlertDeps(store: AppSettingsStore): ProviderAlertDeps {
  const recipient = LIFECYCLE_ADMIN_EMAIL;
  return {
    store,
    now: () => new Date(),
    recipient,
    send: async ({ subject, body }) => {
      await createTransactionalEmailFromEnv().send({ to: recipient, subject, html: `<p>${body}</p>`, text: body });
    },
  };
}

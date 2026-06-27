import type { Block } from "@/lib/blog";

/**
 * Trust-page content. Plain-language, honest, and white-label (no vendor names — third parties
 * are referenced by category). These are solid templates; have counsel review before relying on
 * them, and publish a named sub-processor list if your jurisdiction requires one.
 */
export interface LegalDoc {
  title: string;
  lastUpdated: string;
  intro: string;
  body: Block[];
}

export const PRIVACY_POLICY: LegalDoc = {
  title: "Privacy Policy",
  lastUpdated: "June 2026",
  intro:
    "This policy explains what information Vantera collects, how we use it, and the choices you have. We collect only what we need to run the product for you, and we never sell your data.",
  body: [
    { t: "h2", text: "Information we collect" },
    { t: "ul", items: [
      "Account information — your name, email, workspace details, and billing information.",
      "Usage data — how you interact with the product, so we can operate and improve it.",
      "Connected LinkedIn data — when you connect your account, the information needed to send and read on your behalf, handled through a secure third-party connectivity provider.",
      "Prospect data — business contact and firmographic information used to identify and qualify leads for your outreach.",
    ] },
    { t: "h2", text: "How we use information" },
    { t: "ul", items: [
      "To provide the service — discovery, qualification, drafting, sending, and reporting.",
      "To keep your account safe — enforcing pacing and safety limits that protect your LinkedIn account.",
      "To process payments and manage your subscription.",
      "To improve the product and provide support.",
    ] },
    { t: "h2", text: "Third-party processors" },
    { t: "p", text: "We rely on a small set of trusted third-party processors to operate the service — for hosting and databases, payment processing, AI text generation, prospect data and enrichment, and LinkedIn connectivity. Each is bound by data-processing terms, and we share only what is necessary for that function. A current list of sub-processors is available on request." },
    { t: "h2", text: "Data retention" },
    { t: "p", text: "We retain your data for as long as your account is active. Prospect data that never passes your qualification bar is not retained indefinitely. When you delete your workspace, your data is permanently erased after a short grace period and your connected accounts are disconnected from our processors." },
    { t: "h2", text: "Your rights" },
    { t: "p", text: "You can access, correct, or delete your data at any time. Workspace deletion is available in your settings: it schedules permanent erasure after a 7-day grace period (cancelable), during which your agents are paused so nothing keeps running. You can also request erasure of a specific prospect's data." },
    { t: "h2", text: "Security" },
    { t: "p", text: "Access to your data is scoped to your workspace, secrets are encrypted, and every outbound action is recorded in an audit trail. We design for least privilege — the product can only ever see your own data, never another customer's." },
    { t: "h2", text: "Contact" },
    { t: "p", text: "Questions about privacy or a data request? Email privacy@vanterasystem.com." },
  ],
};

export const TERMS_OF_SERVICE: LegalDoc = {
  title: "Terms of Service",
  lastUpdated: "June 2026",
  intro:
    "These terms govern your use of Vantera. By creating an account or using the service, you agree to them. They're written to be readable — if anything is unclear, just ask.",
  body: [
    { t: "h2", text: "The service" },
    { t: "p", text: "Vantera is a LinkedIn automation platform that helps you identify, qualify, and reach out to prospects, and manage the conversation toward a close. You connect your own LinkedIn account; we act on your behalf within the limits described below." },
    { t: "h2", text: "Your responsibilities" },
    { t: "ul", items: [
      "You control what is sent — every message waits for your approval, and you are responsible for the outreach you approve.",
      "You will comply with LinkedIn's terms and all applicable laws, including anti-spam and data-protection rules.",
      "You will provide accurate account information and keep your credentials secure.",
    ] },
    { t: "h2", text: "Account safety and limits" },
    { t: "p", text: "To protect your LinkedIn account, the service enforces pacing and volume ceilings that cannot be raised above safe thresholds. You agree not to attempt to circumvent these safeguards." },
    { t: "h2", text: "Billing" },
    { t: "p", text: "Paid plans are billed on a recurring basis. Free trials convert to a paid plan only if you choose to continue. You can upgrade, downgrade, or cancel at any time; cancellation stops future charges and takes effect at the end of the current period." },
    { t: "h2", text: "Acceptable use" },
    { t: "ul", items: [
      "No unlawful, deceptive, harassing, or abusive outreach.",
      "No using the service to violate a third party's rights or any platform's terms.",
      "No reselling, reverse-engineering, or attempting to disrupt the service.",
    ] },
    { t: "h2", text: "Disclaimers and liability" },
    { t: "p", text: "The service is provided \"as is.\" We work hard to keep it reliable and safe, but we don't guarantee specific outcomes, and to the extent permitted by law our liability is limited to the amount you paid in the prior twelve months." },
    { t: "h2", text: "Termination" },
    { t: "p", text: "You can stop using the service and delete your workspace at any time. We may suspend or terminate accounts that violate these terms or put other users or the platform at risk." },
    { t: "h2", text: "Contact" },
    { t: "p", text: "Questions about these terms? Email legal@vanterasystem.com." },
  ],
};

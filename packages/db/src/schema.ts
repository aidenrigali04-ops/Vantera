import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    return value.slice(1, -1).split(",").map(Number);
  },
});

// The SQL migrations in ../migrations are the source of truth. This file mirrors them for
// type-safe queries. SQL-only details without a first-class Drizzle representation: FKs to
// auth.users, check constraints (campaigns.targeting max-3, suppression value = lower(value)),
// and the composite same-tenant FKs (lead/campaign/icp refs pair with account_id) — the
// .references() calls below are simplified relational hints.

// ── 0000 foundation ──────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // 0001: onboarding capture + billing refs + per-account kill switch
  onboardingIndustry: text("onboarding_industry"),
  onboardingIcp: text("onboarding_icp"),
  // 0038: the user's role (Founder / Sales / Marketing / …) + their own LinkedIn URL captured on
  // the personalize step — personalize how the agent represents them. Null pre-0038.
  onboardingRole: text("onboarding_role"),
  onboardingLinkedinUrl: text("onboarding_linkedin_url"),
  revenueGoalCents: bigint("revenue_goal_cents", { mode: "number" }),
  // 0012: estimated monthly recurring value per closed client — powers the dashboard
  // revenue snapshot (closed + expected MRR vs. the goal). Null until set in Settings.
  avgDealValueCents: bigint("avg_deal_value_cents", { mode: "number" }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  outreachPaused: boolean("outreach_paused").notNull().default(false),
  // 0007: website context for the Scout agent (scan fields are service-role-written)
  websiteUrl: text("website_url"),
  websiteScan: jsonb("website_scan"),
  websiteScannedAt: timestamp("website_scanned_at", { withTimezone: true }),
  // 0009: CAN-SPAM physical mailing address for cold-email footer (rule 11)
  senderAddress: jsonb("sender_address"),
  // 0019: human sender name for the email sign-off ({{sender_name}}); client-settable in Settings
  senderName: text("sender_name"),
  // 0013: subscription entitlement snapshot (server-managed; Stripe webhook only)
  // No-card free trial (0020; shortened to 3 days in 0037): new accounts default to a
  // Starter trial. Defaults are applied by the DB on create_account insert; the
  // trial_ends_at default expression (now() + 3 days) lives in the SQL migration (source of truth).
  plan: text("plan", { enum: ["none", "starter", "growth", "scale"] })
    .notNull()
    .default("starter"),
  subscriptionStatus: text("subscription_status", {
    enum: ["none", "trialing", "active", "past_due", "canceled"],
  })
    .notNull()
    .default("trialing"),
  seatsPurchased: integer("seats_purchased").notNull().default(0),
  linkedinAccountsPurchased: integer("linkedin_accounts_purchased").notNull().default(0),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
});

export const accountMembers = pgTable(
  "account_members",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // FK to auth.users(id) lives in the SQL migration — the auth schema isn't modeled in Drizzle
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.userId] })]
);

// ── 0001 profiles, onboarding, invites, deletion ─────────────────────────────

export const userProfiles = pgTable("user_profiles", {
  // user-scoped (not tenant-scoped); FK to auth.users in SQL only
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountInvites = pgTable(
  "account_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull(),
    token: uuid("token").notNull().unique().defaultRandom(),
    status: text("status", { enum: ["pending", "accepted", "revoked", "expired"] })
      .notNull()
      .default("pending"),
    invitedBy: uuid("invited_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_invites_account_idx").on(t.accountId)]
);

export const accountDeletionRequests = pgTable(
  "account_deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by"),
    status: text("status", { enum: ["pending", "vendor_cleanup", "completed", "canceled"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("account_deletion_requests_account_idx").on(t.accountId)]
);

// ── 0002 ICPs, leads, enrichment ─────────────────────────────────────────────

export const icps = pgTable(
  "icps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    criteria: jsonb("criteria").notNull().default({}),
    source: text("source", { enum: ["onboarding", "manual"] }).notNull().default("manual"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("icps_account_idx").on(t.accountId)]
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    icpId: uuid("icp_id").references(() => icps.id, { onDelete: "set null" }),
    source: text("source", { enum: ["discovery", "manual", "import", "inbound", "ad", "intent"] })
      .notNull()
      .default("discovery"),
    externalRef: text("external_ref"),
    companyName: text("company_name"),
    companyDomain: text("company_domain"),
    companySize: text("company_size"),
    industry: text("industry"),
    location: text("location"),
    techStack: jsonb("tech_stack"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    title: text("title"),
    email: text("email"),
    emailStatus: text("email_status", { enum: ["unverified", "valid", "invalid", "risky"] })
      .notNull()
      .default("unverified"),
    phone: text("phone"),
    phoneStatus: text("phone_status", { enum: ["unvalidated", "valid", "invalid"] })
      .notNull()
      .default("unvalidated"),
    linkedinUrl: text("linkedin_url"),
    // 0036: DB-maintained normalized LinkedIn URL (lower + trim + strip trailing slash) for O(1)
    // reply attribution. Generated from linkedin_url so it can never drift; the read path falls
    // back to a scan for any JS-vs-SQL normalize edge (findLeadByLinkedInUrl).
    linkedinUrlNormalized: text("linkedin_url_normalized").generatedAlwaysAs(
      sql`regexp_replace(lower(btrim(linkedin_url)), '/+$', '')`
    ),
    // 0034: sticky sender — the LinkedIn account assigned to send this lead's whole
    // sequence (multi-sender distribution, rule 04/13). Null until the first invite.
    linkedinAccountId: uuid("linkedin_account_id").references(() => linkedinAccounts.id, {
      onDelete: "set null",
    }),
    // 0009: LinkedIn invite→accept→message sequencing state (rule 04/08)
    linkedinInvitedAt: timestamp("linkedin_invited_at", { withTimezone: true }),
    linkedinConnectedAt: timestamp("linkedin_connected_at", { withTimezone: true }),
    rulesGatePassed: boolean("rules_gate_passed"),
    rulesGateReasons: jsonb("rules_gate_reasons"),
    aiScore: integer("ai_score"),
    aiRationale: text("ai_rationale"),
    // 0007: structured prospect-brain output (pain_points, triggers, motivations, value_angle, aha_moment, summary)
    aiInsights: jsonb("ai_insights"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    // 0016: close stage (status='converted' is closed-won); value + close date for CRM push
    dealValueCents: bigint("deal_value_cents", { mode: "number" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // 0028: meeting-booked stage for the attribution funnel; server-set only (not client-writable)
    meetingBookedAt: timestamp("meeting_booked_at", { withTimezone: true }),
    status: text("status", {
      enum: [
        "sourced",
        "rejected",
        "qualified",
        "enriched",
        "in_campaign",
        "replied",
        "converted",
        "archived",
      ],
    })
      .notNull()
      .default("sourced"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_account_status_idx").on(t.accountId, t.status),
    index("leads_icp_idx").on(t.icpId),
    index("leads_linkedin_account_idx").on(t.linkedinAccountId),
    // expression/partial indexes (lower(email), ai_score where rules_gate_passed) live in SQL only
  ]
);

export const enrichmentResults = pgTable(
  "enrichment_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["email_verification", "phone_validation", "premium"] }).notNull(),
    provider: text("provider"),
    status: text("status", { enum: ["pending", "success", "failed"] }).notNull().default("pending"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("enrichment_results_lead_idx").on(t.leadId),
    index("enrichment_results_account_idx").on(t.accountId),
  ]
);

// 0031: real buying signals (events + intent) per lead — the "why now" feed + signal→revenue
// attribution. kind is free text (provider taxonomy evolves); writes are service-role only.
export const leadSignals = pgTable(
  "lead_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    detail: text("detail"),
    level: text("level"),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lead_signals_lead_idx").on(t.leadId, t.observedAt),
    index("lead_signals_account_kind_idx").on(t.accountId, t.kind),
    uniqueIndex("lead_signals_unique").on(t.leadId, t.kind, t.label),
  ]
);

// ── 0003 campaigns, scheduler, suppression ───────────────────────────────────

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status", { enum: ["draft", "active", "paused", "completed", "archived"] })
      .notNull()
      .default("draft"),
    channels: text("channels").array().notNull(),
    // max-3 targeting check (rule 08) enforced in SQL
    targeting: jsonb("targeting").notNull().default([]),
    copywritingMode: text("copywriting_mode", { enum: ["user", "agent"] }),
    userCopy: jsonb("user_copy"),
    sendMode: text("send_mode", { enum: ["automatic", "review", "manual"] }),
    runAtTime: time("run_at_time").notNull().default("08:00"),
    cadence: text("cadence", { enum: ["daily", "weekly"] }).notNull().default("daily"),
    timezone: text("timezone").notNull().default("UTC"),
    createdBy: uuid("created_by"),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    // 0017: per-campaign sequence config; null falls back to SEQUENCE_DEFAULTS in code
    sequenceConfig: jsonb("sequence_config"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_account_status_idx").on(t.accountId, t.status)]
);

export const campaignLeads = pgTable(
  "campaign_leads",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "queued", "sent", "replied", "suppressed", "skipped", "completed"],
    })
      .notNull()
      .default("pending"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.leadId] }),
    index("campaign_leads_account_idx").on(t.accountId),
    index("campaign_leads_campaign_status_idx").on(t.campaignId, t.status),
    index("campaign_leads_lead_idx").on(t.leadId),
  ]
);

export const scheduledSends = pgTable(
  "scheduled_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["linkedin"] }).notNull(),
    status: text("status", {
      enum: [
        "drafting",
        "pending_review",
        "approved",
        "scheduled",
        "sending",
        "sent",
        "failed",
        "canceled",
        "suppressed",
      ],
    })
      .notNull()
      .default("drafting"),
    subject: text("subject"),
    body: text("body"),
    // 0012: structured call brief for the caller agent (rides alongside human-readable body)
    brief: jsonb("brief"),
    // unresolved humanizer violations, shown as review-queue badges (0008)
    styleFlags: text("style_flags"),
    // 0009: LinkedIn invite/message pair sequencing (null for email)
    linkedinStage: text("linkedin_stage", { enum: ["invite", "message"] }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("scheduled_sends_account_status_idx").on(t.accountId, t.status),
    index("scheduled_sends_campaign_idx").on(t.campaignId),
    index("scheduled_sends_lead_idx").on(t.leadId),
  ]
);

export const suppressionEntries = pgTable(
  "suppression_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["email", "linkedin", "phone"] }).notNull(),
    value: text("value").notNull(),
    source: text("source", {
      enum: ["unsubscribe", "bounce", "complaint", "manual", "not_interested", "gdpr"],
    }).notNull(),
    note: text("note"),
    // set null, never cascade: suppression survives lead deletion
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("suppression_lookup_idx").on(t.accountId, t.kind, t.value),
    index("suppression_entries_lead_idx").on(t.leadId),
  ]
);

// global/system table (platform kill switch); service-role only — no account_id by design
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// webhook intake idempotency + debugging; service-role only (RLS, no policies);
// retention: purged after 30 days by retention-purge (rule 11)
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: ["email", "linkedin", "stripe", "voice"] }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_source_event_idx").on(t.source, t.providerEventId)]
);

// ── 0004 channel identities, outreach audit ──────────────────────────────────

export const mailboxes = pgTable(
  "mailboxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    emailAddress: text("email_address").notNull(),
    domain: text("domain"),
    providerRef: text("provider_ref"),
    status: text("status", { enum: ["provisioning", "warming", "active", "paused", "error"] })
      .notNull()
      .default("provisioning"),
    warmupStartedAt: timestamp("warmup_started_at", { withTimezone: true }),
    health: jsonb("health"),
    dailySendLimit: integer("daily_send_limit"),
    // 0021: Maildoso per-mailbox SMTP credentials (server-managed; clients never read/write these)
    smtpSecret: text("smtp_secret"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpUsername: text("smtp_username"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mailboxes_account_email_idx").on(t.accountId, t.emailAddress),
    index("mailboxes_account_status_idx").on(t.accountId, t.status),
  ]
);

export const linkedinAccounts = pgTable(
  "linkedin_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    providerRef: text("provider_ref").notNull(),
    profileUrl: text("profile_url"),
    displayName: text("display_name"),
    status: text("status", { enum: ["connecting", "active", "restricted", "disconnected"] })
      .notNull()
      .default("connecting"),
    connectedBy: uuid("connected_by"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("linkedin_accounts_provider_idx").on(t.accountId, t.providerRef),
    index("linkedin_accounts_account_status_idx").on(t.accountId, t.status),
  ]
);

export const outreachSends = pgTable(
  "outreach_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    scheduledSendId: uuid("scheduled_send_id").references(() => scheduledSends.id, {
      onDelete: "set null",
    }),
    channel: text("channel", { enum: ["linkedin"] }).notNull(),
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    linkedinAccountId: uuid("linkedin_account_id").references(() => linkedinAccounts.id, {
      onDelete: "set null",
    }),
    messageRef: text("message_ref"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("outreach_sends_account_sent_idx").on(t.accountId, t.sentAt),
    index("outreach_sends_campaign_idx").on(t.campaignId),
    index("outreach_sends_lead_idx").on(t.leadId),
    index("outreach_sends_scheduled_send_idx").on(t.scheduledSendId),
    index("outreach_sends_mailbox_idx").on(t.mailboxId),
    index("outreach_sends_linkedin_account_idx").on(t.linkedinAccountId),
  ]
);

export const replies = pgTable(
  "replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    outreachSendId: uuid("outreach_send_id").references(() => outreachSends.id, {
      onDelete: "set null",
    }),
    channel: text("channel", { enum: ["linkedin"] }).notNull(),
    providerMessageRef: text("provider_message_ref"),
    body: text("body"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    classification: text("classification", {
      enum: [
        "interested",
        "not_interested",
        "neutral",
        "out_of_office",
        "bounce",
        "unsubscribe",
        "other",
      ],
    }),
    classificationRationale: text("classification_rationale"),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("replies_account_received_idx").on(t.accountId, t.receivedAt),
    index("replies_lead_idx").on(t.leadId),
    index("replies_campaign_idx").on(t.campaignId),
    index("replies_outreach_send_idx").on(t.outreachSendId),
  ]
);

export const unsubscribeTokens = pgTable(
  "unsubscribe_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: uuid("token").notNull().unique().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [
    index("unsubscribe_tokens_lead_idx").on(t.leadId),
    index("unsubscribe_tokens_account_idx").on(t.accountId),
  ]
);

// ── 0007 SDR agents (Scout + Copy) ───────────────────────────────────────────

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["scout", "copy", "intent"] }).notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["draft", "live", "paused"] }).notNull().default("draft"),
    // scout: {prospects_per_run, min_score}; copy: {cta, channels: {linkedin}};
    // intent: {watch:{creators,competitors,keywords,hashtags}, signals:{engagement,content}}
    config: jsonb("config").notNull().default({}),
    // scheduling block (scout agents only)
    runAtTime: time("run_at_time"),
    cadence: text("cadence", { enum: ["daily", "weekly"] }),
    timezone: text("timezone").notNull().default("UTC"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    // copy agent's internal execution campaign (composite same-tenant FK in SQL)
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // one agent per kind per account in v1 (the Copy wizard reads "the" Scout's ICPs)
    uniqueIndex("agents_account_kind_unique").on(t.accountId, t.kind),
    index("agents_due_idx").on(t.status, t.nextRunAt),
    index("agents_campaign_idx").on(t.campaignId),
  ]
);

export const agentIcps = pgTable(
  "agent_icps",
  {
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    icpId: uuid("icp_id")
      .notNull()
      .references(() => icps.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.icpId] }),
    index("agent_icps_account_idx").on(t.accountId),
    index("agent_icps_icp_idx").on(t.icpId),
  ]
);

export const agentAssets = pgTable(
  "agent_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["file", "image", "link"] }).notNull(),
    storagePath: text("storage_path"),
    url: text("url"),
    filename: text("filename"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_assets_agent_idx").on(t.agentId), index("agent_assets_account_idx").on(t.accountId)]
);

// ── 0029 inbound responder ───────────────────────────────────────────────────

// Intake log + SLA tracker for the Responder agent: one row per inbound lead event.
// Writes via the service-role intake pipeline only (no client write policy).
export const inboundLeads = pgTable(
  "inbound_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull(),
    leadId: uuid("lead_id"),
    source: text("source", { enum: ["form_fill", "website_visitor", "signal"] }).notNull(),
    email: text("email"),
    firstName: text("first_name"),
    companyName: text("company_name"),
    payload: jsonb("payload").notNull().default({}),
    status: text("status", {
      enum: ["received", "qualified", "rejected", "suppressed", "responded", "review", "error"],
    })
      .notNull()
      .default("received"),
    // SLA measurement (speed is the product): received_at → responded_at
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inbound_leads_account_status_idx").on(t.accountId, t.status),
    index("inbound_leads_agent_idx").on(t.agentId),
    index("inbound_leads_lead_idx").on(t.leadId),
  ]
);

// Signing secret for the inbound intake webhook. Service-role only — RLS on, NO policies
// (FKs to auth not modeled here; secret_enc is encrypted at rest, never client-readable).
export const inboundIntakeSecrets = pgTable(
  "inbound_intake_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull(),
    intakeId: uuid("intake_id").notNull(),
    secretEnc: text("secret_enc").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("inbound_intake_secrets_agent_unique").on(t.agentId),
    uniqueIndex("inbound_intake_secrets_intake_idx").on(t.intakeId),
  ]
);

// ── 0030 meta ads + nurturing ────────────────────────────────────────────────

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    offer: text("offer").notNull(),
    targetIcp: text("target_icp").notNull(),
    cta: text("cta").notNull(),
    status: text("status", { enum: ["draft", "published", "paused", "archived"] })
      .notNull()
      .default("draft"),
    dailyBudgetCents: bigint("daily_budget_cents", { mode: "number" }),
    leadFormId: text("lead_form_id"),
    providerCampaignId: text("provider_campaign_id"),
    campaignRef: uuid("campaign_ref").notNull().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ad_campaigns_account_idx").on(t.accountId), uniqueIndex("ad_campaigns_ref_idx").on(t.campaignRef)]
);

export const adCreatives = pgTable(
  "ad_creatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    adCampaignId: uuid("ad_campaign_id").notNull(),
    headline: text("headline").notNull(),
    primaryText: text("primary_text").notNull(),
    description: text("description"),
    cta: text("cta").notNull(),
    creativePrompt: text("creative_prompt").notNull(),
    creativeUrl: text("creative_url"),
    styleFlags: text("style_flags"),
    status: text("status", { enum: ["draft", "selected", "published"] }).notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ad_creatives_campaign_idx").on(t.adCampaignId),
    index("ad_creatives_account_idx").on(t.accountId),
  ]
);

// ── 0005 copilot ─────────────────────────────────────────────────────────────

export const copilotActions = pgTable(
  "copilot_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    toolName: text("tool_name").notNull(),
    tier: text("tier", { enum: ["read", "navigate", "mutate", "critical"] }).notNull(),
    input: jsonb("input"),
    resultStatus: text("result_status", {
      enum: ["success", "error", "denied", "undone"],
    }).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    conversationId: uuid("conversation_id"),
    undoable: boolean("undoable").notNull().default(false),
    undoExpiresAt: timestamp("undo_expires_at", { withTimezone: true }),
    undoPayload: jsonb("undo_payload"),
  },
  (t) => [
    index("copilot_actions_account_created_idx").on(t.accountId, t.createdAt),
    index("copilot_actions_user_idx").on(t.userId),
  ]
);

export const copilotKnowledgeGaps = pgTable(
  "copilot_knowledge_gaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    surface: text("surface"),
    status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("copilot_knowledge_gaps_account_status_idx").on(t.accountId, t.status)]
);

// ── 0011 copilot v1 ───────────────────────────────────────────────────────────

export const copilotConversations = pgTable(
  "copilot_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    currentSurface: text("current_surface"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("copilot_conversations_account_idx").on(t.accountId, t.updatedAt.desc())]
);

export const copilotMessages = pgTable(
  "copilot_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => copilotConversations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull().default(""),
    toolCalls: jsonb("tool_calls"),
    feedback: text("feedback", { enum: ["up", "down"] }),
    unhelpful: boolean("unhelpful").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("copilot_messages_conversation_idx").on(t.conversationId, t.createdAt)]
);

// ── 0012 AI Caller agent ─────────────────────────────────────────────────────

// retention(calls): one row per dial attempt; cascades with the lead. Terminal rows
// purged by the 180-day scheduled_sends sweep companion (rule 11).
// Writes arrive via the service-role pipeline only (no client write policy).
export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    campaignId: uuid("campaign_id").notNull(),
    scheduledSendId: uuid("scheduled_send_id")
      .notNull()
      .references(() => scheduledSends.id, { onDelete: "cascade" }),
    providerCallId: text("provider_call_id"),
    attemptNo: smallint("attempt_no").notNull().default(1),
    status: text("status", {
      enum: ["queued", "dialing", "in_progress", "completed", "no_answer", "voicemail", "failed"],
    })
      .notNull()
      .default("queued"),
    outcome: text("outcome", {
      enum: ["booked", "callback", "not_interested", "no_answer", "voicemail", "do_not_call"],
    }),
    durationSec: integer("duration_sec"),
    recordingUrl: text("recording_url"),
    transcript: text("transcript"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // composite same-tenant FKs enforced in SQL; simplified relational hints here
    // calls_provider_call_idx is a partial unique index in SQL (where provider_call_id is not null)
    index("calls_provider_call_idx").on(t.providerCallId),
    index("calls_account_status_idx").on(t.accountId, t.status),
    index("calls_lead_idx").on(t.leadId),
    index("calls_send_idx").on(t.scheduledSendId),
  ]
);

// Global reference data — no account_id by design (identical for every tenant).
// Service-role only (RLS on, no tenant policies); accessed via match_copilot_chunks() SECURITY DEFINER fn.
// retention: rebuilt at deploy, not purged.
export const copilotKnowledgeChunks = pgTable(
  "copilot_knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    heading: text("heading"),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull().unique(),
    embedding: vector1024("embedding").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("copilot_knowledge_chunks_slug_idx").on(t.slug)]
);

// CRM push connections (Phase 9, migration 0015). One row per destination per account.
// Tokens are written service-role-side only and never selected client-side (see migration).
// config: { autoPush, target: {...}, mapping: {...} }.
export const crmConnections = pgTable(
  "crm_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    provider: text("provider", {
      enum: ["hubspot", "salesforce", "gohighlevel", "slack", "monday"],
    }).notNull(),
    kind: text("kind", { enum: ["crm", "notify"] }).notNull(),
    status: text("status", { enum: ["connecting", "active", "error", "disconnected"] })
      .notNull()
      .default("connecting"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    externalAccountRef: text("external_account_ref"),
    config: jsonb("config").notNull().default({}),
    lastError: text("last_error"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("crm_connections_account_provider_idx").on(t.accountId, t.provider),
    index("crm_connections_account_status_idx").on(t.accountId, t.status),
  ]
);

// CRM push audit + retry queue (Phase 9, migration 0016). One row per push attempt of a
// closed-won lead to a connection; also the per-lead push-status + connection-health surface.
export const crmPushEvents = pgTable(
  "crm_push_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => crmConnections.id, {
      onDelete: "cascade",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    status: text("status", { enum: ["pending", "success", "failed"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    payload: jsonb("payload"),
    externalRef: text("external_ref"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("crm_push_events_account_status_idx").on(t.accountId, t.status),
    index("crm_push_events_lead_idx").on(t.leadId),
    index("crm_push_events_connection_idx").on(t.connectionId),
    index("crm_push_events_retry_idx").on(t.nextRetryAt),
  ]
);

// ── 0017 sequence orchestrator ────────────────────────────────────────────────

// retention(sequence_runs): one active run per lead per campaign; cascades with lead/campaign.
// Terminal runs (converted/exhausted/stopped) are kept for audit and swept with the lead.
// Writes arrive via the service-role orchestrator only (no client write policy).
export const sequenceRuns = pgTable(
  "sequence_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull(),
    leadId: uuid("lead_id").notNull(),
    status: text("status", {
      enum: ["active", "paused_reply", "converted", "exhausted", "stopped"],
    })
      .notNull()
      .default("active"),
    currentStage: text("current_stage", {
      enum: ["linkedin", "done"],
    })
      .notNull()
      .default("linkedin"),
    touchesDone: smallint("touches_done").notNull().default(0),
    callAttempts: smallint("call_attempts").notNull().default(0),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }).notNull().defaultNow(),
    enteredStageAt: timestamp("entered_stage_at", { withTimezone: true }).notNull().defaultNow(),
    lastTouchAt: timestamp("last_touch_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // composite same-tenant FKs (campaign_id/lead_id pair with account_id) enforced in SQL only
    // partial unique index in SQL (where status = 'active'); simplified here
    index("sequence_runs_due_idx").on(t.nextActionAt),
    index("sequence_runs_account_idx").on(t.accountId),
    index("sequence_runs_lead_idx").on(t.leadId),
    uniqueIndex("sequence_runs_campaign_lead_unique").on(t.campaignId, t.leadId),
  ]
);

// retention(lead_notifications): in-app alerts (e.g. a lead replied). Read by members;
// written by the pipeline. Swept with the lead.
export const leadNotifications = pgTable(
  "lead_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    kind: text("kind", { enum: ["reply", "converted", "exhausted", "hot_signal"] }).notNull(),
    body: text("body").notNull(),
    // no updated_at: read_at is the only mutable field
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // partial index in SQL (where read_at is null); simplified here
    index("lead_notifications_account_unread_idx").on(t.accountId, t.createdAt),
    index("lead_notifications_lead_idx").on(t.leadId),
  ]
);

// ── 0018 conversion tokens ────────────────────────────────────────────────────

// retention(conversion_tokens): one-shot tracked-CTA tokens; swept with the lead/campaign.
// Service-role write surface (issued + marked used by the redirect route); members may read.
export const conversionTokens = pgTable(
  "conversion_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull(),
    leadId: uuid("lead_id").notNull(),
    targetUrl: text("target_url").notNull(),
    token: uuid("token").notNull().unique().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [
    index("conversion_tokens_lead_idx").on(t.leadId),
    index("conversion_tokens_account_idx").on(t.accountId),
  ]
);

// ── 0027 security audit log ───────────────────────────────────────────────────

// Append-only audit of security-relevant activity (failed logins, webhook signature
// failures, rate-limit hits, sensitive mutations). Service-role writes only; account admins
// read their own. account_id is nullable by design — system/global events (e.g. a webhook
// with no resolvable account, a failed login before account resolution) have none and are
// hidden from all client roles (tenant-exempt in schema.test.ts).
// retention(security_events): 180 days, trimmed by a scheduled purge (rule 11 audit trail).
export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id"),
    eventType: text("event_type").notNull(),
    severity: text("severity", { enum: ["info", "warn", "critical"] }).notNull().default("info"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("security_events_account_created_idx").on(t.accountId, t.createdAt),
    index("security_events_type_created_idx").on(t.eventType, t.createdAt),
  ]
);

// ── 0033 intent agent ────────────────────────────────────────────────────────

// Observation log for the Intent Agent — one row per (person, post) seen engaging or
// publishing on LinkedIn. Dedupe ledger + audit trail; service-role writes only (RLS on,
// member select policy). Retention: 90-day sweep of non-enrolled rows (rule 11).
export const intentObservations = pgTable(
  "intent_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull(),
    leadId: uuid("lead_id"),
    profileUrl: text("profile_url").notNull(),
    signalKind: text("signal_kind", { enum: ["engagement", "content"] }).notNull(),
    watchTarget: text("watch_target"),
    postRef: text("post_ref").notNull(),
    headline: text("headline"),
    detail: text("detail"),
    outcome: text("outcome", {
      enum: ["observed", "qualified", "rejected", "suppressed", "enrolled"],
    })
      .notNull()
      .default("observed"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("intent_observations_dedupe_idx").on(t.accountId, t.profileUrl, t.postRef),
    index("intent_observations_account_outcome_idx").on(t.accountId, t.outcome),
    index("intent_observations_agent_idx").on(t.agentId),
    index("intent_observations_lead_idx").on(t.leadId),
  ]
);


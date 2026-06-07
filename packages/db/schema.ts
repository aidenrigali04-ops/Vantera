import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  integer,
  bigint,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

export const verticalEnum = pgEnum('vertical', [
  'agency',
  'hvac',
  'landscaping',
  'plumbing',
  'construction',
  'property_mgmt',
  'real_estate',
])

export const planEnum = pgEnum('plan', ['team', 'enterprise'])

export const roleEnum = pgEnum('role', [
  'owner',
  'admin',
  'manager',
  'staff',
  'technician',
  'agent',
])

export const accountInviteStatusEnum = pgEnum('account_invite_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
])

export const contactTypeEnum = pgEnum('contact_type', [
  'customer',
  'tenant',
  'owner',
  'agency_client',
  'buyer',
  'seller',
  'landlord',
])

export const priorityEnum = pgEnum('priority', ['urgent', 'high', 'normal', 'low'])

export const actorTypeEnum = pgEnum('actor_type', [
  'user',
  'system',
  'automation',
  'contact',
])

export const channelEnum = pgEnum('channel', ['sms', 'email', 'portal', 'linkedin'])

export const directionEnum = pgEnum('direction', ['outbound', 'inbound'])

export const messageStatusEnum = pgEnum('message_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
  'read',
])

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'voided',
])

export const severityEnum = pgEnum('severity', ['red', 'yellow', 'green'])

export const runStatusEnum = pgEnum('run_status', [
  'pending',
  'running',
  'success',
  'failed',
])

export const lifecycleStageEnum = pgEnum('lifecycle_stage', [
  'prospect',
  'active_client',
  'churned',
])

export const leadSourceEnum = pgEnum('lead_source', [
  'linkedin',
  'aspire',
  'manual',
  'csv',
  'form',
  'referral',
  'hubspot',
  'gohighlevel',
  'salesforce',
  'sdr_agent',
])

export const relationshipStatusEnum = pgEnum('relationship_status', [
  'new',
  'contacted',
  'connected',
  'nurturing',
  'qualified',
  'discovery_booked',
  'proposal_sent',
  'won',
  'lost',
])

export const linkedinCampaignStatusEnum = pgEnum('linkedin_campaign_status', [
  'active',
  'paused',
  'completed',
])

export const sequenceStepStatusEnum = pgEnum('sequence_step_status', [
  'pending',
  'sent',
  'failed',
  'skipped',
  'cancelled',
])

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  vertical: verticalEnum('vertical').notNull(),
  plan: planEnum('plan').notNull().default('team'),
  brandLogoUrl: text('brand_logo_url'),
  brandPrimaryColor: varchar('brand_primary_color', { length: 7 }).default('#1648A0'),
  brandSecondaryColor: varchar('brand_secondary_color', { length: 7 }).default('#0D9488'),
  portalDomain: varchar('portal_domain', { length: 255 }),
  /** not_configured | pending | verified | failed */
  portalDomainStatus: varchar('portal_domain_status', { length: 32 }).default('not_configured'),
  /** DNS / Vercel verification hints shown in Settings */
  portalDomainDns: jsonb('portal_domain_dns').default({}),
  /** Admin-driven client portal: sections, services, welcome copy, support links. */
  portalConfig: jsonb('portal_config').notNull().default({}),
  timezone: varchar('timezone', { length: 60 }).notNull().default('America/Los_Angeles'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  onboardingCompletedAt: timestamptz('onboarding_completed_at'),

  /** Monthly revenue goal (MRR target, whole dollars) set during onboarding. */
  mrrGoal: integer('mrr_goal'),
  /** Average monthly revenue per won client — powers MRR progress on the dashboard. */
  avgClientValue: integer('avg_client_value'),

  // Personalization profile (used by `personalizeTemplate` at apply time).
  // All optional — falls back to portal-URL defaults when null.
  bookingLink: text('booking_link'),
  reviewLink: text('review_link'),
  paymentLink: text('payment_link'),
  emergencyLine: varchar('emergency_line', { length: 50 }),
  businessHoursStart: smallint('business_hours_start'),
  businessHoursEnd: smallint('business_hours_end'),
  voicePreference: varchar('voice_preference', { length: 20 }),

  /** Owner-written ideal customer profile from onboarding. */
  icpDescription: text('icp_description'),
  /** One-line ICP headline from onboarding AI analysis. */
  icpSummary: text('icp_summary'),
  /** Owner-written value proposition / solutions offered from onboarding. */
  valueProposition: text('value_proposition'),
  /** Public website URL from onboarding. */
  websiteUrl: text('website_url'),

  // Tracks which template was applied so integration-connect flows can
  // re-run personalization against the current profile.
  activeTemplateId: uuid('active_template_id'),

  // White-label outreach email (Resend verified domain per account)
  outreachFromDomain: varchar('outreach_from_domain', { length: 255 }),
  outreachInboundDomain: varchar('outreach_inbound_domain', { length: 255 }),
  outreachFromLocalPart: varchar('outreach_from_local_part', { length: 64 }).default('outreach'),
  outreachDomainStatus: varchar('outreach_domain_status', { length: 32 }).default('not_configured'),
  resendOutreachDomainId: varchar('resend_outreach_domain_id', { length: 255 }),
  outreachDomainDns: jsonb('outreach_domain_dns').default({}),

  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
})

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('staff'),
    avatarUrl: text('avatar_url'),
    phone: varchar('phone', { length: 30 }),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamptz('last_login_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('users_account_id_idx').on(table.accountId),
    emailAccountIdx: uniqueIndex('users_email_account_idx').on(table.email, table.accountId),
  }),
)

/**
 * Pending team-seat invitations. A seat is occupied by an active `users` row
 * OR a pending invite here — kept separate so invites can be resent/revoked
 * and seat counts stay honest. On accept, an active `users` row is created and
 * the invite is marked `accepted`.
 */
export const accountInvites = pgTable(
  'account_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('staff'),
    status: accountInviteStatusEnum('status').notNull().default('pending'),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamptz('expires_at').notNull(),
    acceptedAt: timestamptz('accepted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('account_invites_account_idx').on(table.accountId),
    statusIdx: index('account_invites_status_idx').on(table.accountId, table.status),
    tokenHashIdx: uniqueIndex('account_invites_token_hash_idx').on(table.tokenHash),
    // One live (pending) invite per email per account.
    pendingEmailIdx: uniqueIndex('account_invites_pending_email_idx')
      .on(table.accountId, table.email)
      .where(sql`${table.status} = 'pending'`),
  }),
)

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    type: contactTypeEnum('type').notNull().default('customer'),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 50 }),
    zip: varchar('zip', { length: 20 }),
    portalAccess: boolean('portal_access').notNull().default(false),
    portalPasswordHash: text('portal_password_hash'),
    portalAccountCreatedAt: timestamptz('portal_account_created_at'),
    portalLastLoginAt: timestamptz('portal_last_login_at'),
    portalInvitedAt: timestamptz('portal_invited_at'),
    ltvCents: bigint('ltv_cents', { mode: 'number' }).notNull().default(0),
    churnRiskScore: smallint('churn_risk_score').notNull().default(0),
    upsellScore: smallint('upsell_score').notNull().default(0),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    source: varchar('source', { length: 100 }),
    notes: text('notes'),
    lifecycleStage: lifecycleStageEnum('lifecycle_stage').notNull().default('active_client'),
    company: varchar('company', { length: 255 }),
    jobTitle: varchar('job_title', { length: 255 }),
    linkedinUrl: text('linkedin_url'),
    convertedFromLeadId: uuid('converted_from_lead_id'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('contacts_account_id_idx').on(table.accountId),
    emailAccountIdx: index('contacts_email_account_idx').on(table.email, table.accountId),
  }),
)

export const portalInviteTokens = pgTable(
  'portal_invite_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    contactIdx: index('portal_invite_tokens_contact_idx').on(table.contactId),
    tokenHashIdx: uniqueIndex('portal_invite_tokens_hash_idx').on(table.tokenHash),
  }),
)

export const stageDefinitions = pgTable(
  'stage_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    recordType: varchar('record_type', { length: 60 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    position: smallint('position').notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#64748B'),
    triggersAutomation: boolean('triggers_automation').notNull().default(true),
    isTerminalWin: boolean('is_terminal_win').notNull().default(false),
    isTerminalLoss: boolean('is_terminal_loss').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('stage_definitions_account_id_idx').on(table.accountId),
    accountRecordTypeIdx: index('stage_definitions_account_record_type_idx').on(
      table.accountId,
      table.recordType,
    ),
  }),
)

export const records = pgTable(
  'records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id),
    recordType: varchar('record_type', { length: 60 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => stageDefinitions.id),
    assignedUserId: uuid('assigned_user_id').references(() => users.id),
    priority: priorityEnum('priority').notNull().default('normal'),
    valueCents: bigint('value_cents', { mode: 'number' }).notNull().default(0),
    actualValueCents: bigint('actual_value_cents', { mode: 'number' }).notNull().default(0),
    scheduledAt: timestamptz('scheduled_at'),
    completedAt: timestamptz('completed_at'),
    dueAt: timestamptz('due_at'),
    metadata: jsonb('metadata').notNull().default({}),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrenceRule: text('recurrence_rule'),
    source: varchar('source', { length: 100 }),
    closeProbability: smallint('close_probability').notNull().default(50),
    isPipeline: boolean('is_pipeline').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('records_account_id_idx').on(table.accountId),
    contactIdx: index('records_contact_id_idx').on(table.contactId, table.accountId),
    stageIdx: index('records_stage_id_idx').on(table.stageId, table.accountId),
    assignedIdx: index('records_assigned_user_id_idx').on(table.assignedUserId, table.accountId),
    scheduledIdx: index('records_scheduled_at_idx').on(table.scheduledAt, table.accountId),
  }),
)

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id').references(() => records.id),
    contactId: uuid('contact_id').references(() => contacts.id),
    leadId: uuid('lead_id'),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id').notNull(),
    activityType: varchar('activity_type', { length: 80 }).notNull(),
    body: text('body'),
    metadata: jsonb('metadata').notNull().default({}),
    visibleToClient: boolean('visible_to_client').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('activities_account_id_idx').on(table.accountId),
    recordIdx: index('activities_record_id_idx').on(table.recordId, table.accountId),
    contactIdx: index('activities_contact_id_idx').on(table.contactId, table.accountId),
    leadIdx: index('activities_lead_id_idx').on(table.leadId, table.accountId),
    createdAtIdx: index('activities_created_at_idx').on(table.createdAt),
  }),
)

export const automations = pgTable(
  'automations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    triggerEvent: varchar('trigger_event', { length: 100 }).notNull(),
    triggerConditions: jsonb('trigger_conditions').notNull().default({}),
    actions: jsonb('actions').array().notNull().default(sql`'{}'::jsonb[]`),
    lastFiredAt: timestamptz('last_fired_at'),
    fireCount: smallint('fire_count').notNull().default(0),
    templateRef: varchar('template_ref', { length: 80 }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('automations_account_id_idx').on(table.accountId),
    triggerIdx: index('automations_trigger_event_idx').on(table.triggerEvent, table.accountId),
  }),
)

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automations.id),
    triggerEvent: varchar('trigger_event', { length: 100 }).notNull(),
    triggerPayload: jsonb('trigger_payload').notNull().default({}),
    actionType: varchar('action_type', { length: 80 }).notNull(),
    status: runStatusEnum('status').notNull().default('pending'),
    resultPayload: jsonb('result_payload').notNull().default({}),
    errorMessage: text('error_message'),
    executedAt: timestamptz('executed_at').notNull().defaultNow(),
    completedAt: timestamptz('completed_at'),
  },
  (table) => ({
    accountIdx: index('automation_runs_account_id_idx').on(table.accountId),
    automationIdx: index('automation_runs_automation_id_idx').on(table.automationId),
    statusIdx: index('automation_runs_status_idx').on(table.status, table.accountId),
  }),
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id').references(() => records.id),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id),
    direction: directionEnum('direction').notNull(),
    channel: channelEnum('channel').notNull(),
    subject: varchar('subject', { length: 500 }),
    body: text('body').notNull(),
    status: messageStatusEnum('status').notNull().default('queued'),
    automationId: uuid('automation_id').references(() => automations.id),
    metadata: jsonb('metadata').notNull().default({}),
    sentAt: timestamptz('sent_at'),
    readAt: timestamptz('read_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('messages_account_id_idx').on(table.accountId),
    contactIdx: index('messages_contact_id_idx').on(table.contactId, table.accountId),
    recordIdx: index('messages_record_id_idx').on(table.recordId, table.accountId),
    statusIdx: index('messages_status_idx').on(table.status, table.accountId),
  }),
)

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id')
      .notNull()
      .references(() => records.id),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id),
    stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    paidCents: bigint('paid_cents', { mode: 'number' }).notNull().default(0),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    dueAt: timestamptz('due_at'),
    paidAt: timestamptz('paid_at'),
    lineItems: jsonb('line_items').array().notNull().default(sql`'{}'::jsonb[]`),
    paymentLinkUrl: text('payment_link_url'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('invoices_account_id_idx').on(table.accountId),
    statusIdx: index('invoices_status_account_idx').on(table.status, table.accountId),
    contactIdx: index('invoices_contact_id_idx').on(table.contactId, table.accountId),
  }),
)

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id').references(() => records.id),
    contactId: uuid('contact_id').references(() => contacts.id),
    docType: varchar('doc_type', { length: 80 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    storageUrl: text('storage_url').notNull(),
    requiresSignature: boolean('requires_signature').notNull().default(false),
    signedAt: timestamptz('signed_at'),
    signerContactId: uuid('signer_contact_id').references(() => contacts.id),
    visibleToClient: boolean('visible_to_client').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('documents_account_id_idx').on(table.accountId),
    recordIdx: index('documents_record_id_idx').on(table.recordId, table.accountId),
  }),
)

export const intelligenceSignals = pgTable(
  'intelligence_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id').references(() => records.id),
    contactId: uuid('contact_id').references(() => contacts.id),
    signalType: varchar('signal_type', { length: 80 }).notNull(),
    severity: severityEnum('severity').notNull(),
    headline: varchar('headline', { length: 255 }).notNull(),
    recommendation: text('recommendation'),
    actionLabel: varchar('action_label', { length: 80 }),
    actionPayload: jsonb('action_payload').notNull().default({}),
    confidenceScore: smallint('confidence_score').notNull().default(0),
    isDismissed: boolean('is_dismissed').notNull().default(false),
    dismissedByUserId: uuid('dismissed_by_user_id').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at'),
  },
  (table) => ({
    accountIdx: index('signals_account_id_idx').on(table.accountId),
    severityIdx: index('signals_severity_account_idx').on(
      table.severity,
      table.accountId,
      table.isDismissed,
    ),
  }),
)

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    flagName: varchar('flag_name', { length: 80 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueFlag: uniqueIndex('feature_flags_account_flag_idx').on(table.accountId, table.flagName),
  }),
)

export const integrationCredentials = pgTable(
  'integration_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 60 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamptz('expires_at'),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    metadata: jsonb('metadata').notNull().default({}),
    isNativeMode: boolean('is_native_mode').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueProvider: uniqueIndex('integration_credentials_account_provider_idx').on(
      table.accountId,
      table.provider,
    ),
  }),
)

export const verticalTemplates = pgTable('vertical_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  vertical: verticalEnum('vertical').notNull(),
  recordType: varchar('record_type', { length: 60 }).notNull(),
  templateData: jsonb('template_data').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Core services — Pipeline, Aspire, LinkedIn Automation
// ---------------------------------------------------------------------------

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    title: varchar('title', { length: 255 }),
    company: varchar('company', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    linkedinUrl: text('linkedin_url'),
    avatarUrl: text('avatar_url'),
    source: leadSourceEnum('source').notNull().default('manual'),
    relationshipStatus: relationshipStatusEnum('relationship_status').notNull().default('new'),
    pipelineStage: varchar('pipeline_stage', { length: 80 }).notNull().default('prospect'),
    ownerId: uuid('owner_id').references(() => users.id),
    score: smallint('score').notNull().default(0),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    enrichment: jsonb('enrichment').notNull().default({}),
    notes: text('notes'),
    convertedContactId: uuid('converted_contact_id').references(() => contacts.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('leads_account_id_idx').on(table.accountId),
    ownerIdx: index('leads_owner_id_idx').on(table.ownerId, table.accountId),
    statusIdx: index('leads_relationship_status_idx').on(table.relationshipStatus, table.accountId),
    sourceIdx: index('leads_source_idx').on(table.source, table.accountId),
  }),
)

export const leadProfiles = pgTable(
  'lead_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    disc: varchar('disc', { length: 1 }),
    awarenessLevel: smallint('awareness_level'),
    topTriggers: jsonb('top_triggers').notNull().default([]),
    primaryFear: text('primary_fear'),
    egoIdentity: text('ego_identity'),
    openingHook: text('opening_hook'),
    doNot: text('do_not'),
    profiledAt: timestamptz('profiled_at').notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: uniqueIndex('lead_profiles_lead_id_idx').on(table.leadId),
    accountIdx: index('lead_profiles_account_id_idx').on(table.accountId),
  }),
)

export const aspireSavedSearches = pgTable(
  'aspire_saved_searches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    filters: jsonb('filters').notNull().default({}),
    audienceId: uuid('audience_id'),
    runFrequency: varchar('run_frequency', { length: 20 }).notNull().default('weekly'),
    lastRunAt: timestamptz('last_run_at'),
    totalFound: smallint('total_found').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    icpConfig: jsonb('icp_config'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('aspire_saved_searches_account_id_idx').on(table.accountId),
    activeIdx: index('aspire_saved_searches_active_idx').on(table.isActive, table.accountId),
  }),
)

export const aspireResults = pgTable(
  'aspire_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    searchId: uuid('search_id').references(() => aspireSavedSearches.id),
    leadId: uuid('lead_id').references(() => leads.id),
    apifyId: varchar('apify_id', { length: 255 }),
    rawData: jsonb('raw_data').notNull().default({}),
    icpScore: smallint('icp_score').notNull().default(0),
    icpSignals: jsonb('icp_signals').notNull().default([]),
    status: varchar('status', { length: 30 }).notNull().default('found'),
    enrolledAt: timestamptz('enrolled_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('aspire_results_account_id_idx').on(table.accountId),
    searchIdx: index('aspire_results_search_id_idx').on(table.searchId, table.accountId),
    apifyUniq: uniqueIndex('aspire_results_account_apify_idx').on(table.accountId, table.apifyId),
  }),
)

export const leadDrafts = pgTable(
  'lead_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 20 }).notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    draftedBy: varchar('drafted_by', { length: 80 }).notNull().default('Sales Assistant'),
    status: varchar('status', { length: 30 }).notNull().default('pending_review'),
    approvedBy: uuid('approved_by').references(() => users.id),
    sentAt: timestamptz('sent_at'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('lead_drafts_account_id_idx').on(table.accountId),
    leadIdx: index('lead_drafts_lead_id_idx').on(table.leadId, table.accountId),
    statusIdx: index('lead_drafts_status_idx').on(table.status, table.accountId),
  }),
)

export const leadScores = pgTable(
  'lead_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    icpScore: smallint('icp_score').notNull(),
    engagementScore: smallint('engagement_score').notNull(),
    compositeScore: smallint('composite_score').notNull(),
    signals: jsonb('signals').notNull().default({}),
    scoredAt: timestamptz('scored_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('lead_scores_account_id_idx').on(table.accountId),
    leadIdx: index('lead_scores_lead_id_idx').on(table.leadId, table.accountId),
    scoredAtIdx: index('lead_scores_scored_at_idx').on(table.scoredAt, table.accountId),
  }),
)

export const sdrAgentConfigs = pgTable(
  'sdr_agent_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .unique()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(),
    agentTitle: text('agent_title').notNull().default('Sales Development Rep'),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name').notNull(),
    signature: text('signature'),
    icpConfig: jsonb('icp_config').notNull().default({}),
    targetVerticals: text('target_verticals').array().notNull().default(sql`'{}'::text[]`),
    targetCities: text('target_cities').array().notNull().default(sql`'{}'::text[]`),
    excludeDomains: text('exclude_domains').array().notNull().default(sql`'{}'::text[]`),
    searchFrequency: varchar('search_frequency', { length: 20 }).notNull().default('daily'),
    outreachDays: text('outreach_days').array().notNull().default(sql`ARRAY['mon','tue','wed','thu','fri']`),
    outreachWindow: jsonb('outreach_window')
      .notNull()
      .default({ startHour: 8, endHour: 17, tz: 'America/New_York' }),
    maxNewLeadsDay: smallint('max_new_leads_day').notNull().default(10),
    maxActiveLeads: smallint('max_active_leads').notNull().default(200),
    isActive: boolean('is_active').notNull().default(false),
    isPaused: boolean('is_paused').notNull().default(false),
    pausedReason: text('paused_reason'),
    lastRunAt: timestamptz('last_run_at'),
    totalLeadsFound: integer('total_leads_found').notNull().default(0),
    totalContacted: integer('total_contacted').notNull().default(0),
    totalReplied: integer('total_replied').notNull().default(0),
    totalBooked: integer('total_booked').notNull().default(0),
    prospectMode: varchar('prospect_mode', { length: 20 }).notNull().default('aspire_bound'),
    defaultMinIcpScore: smallint('default_min_icp_score').notNull().default(70),
    syncIcpToSavedSearches: boolean('sync_icp_to_saved_searches').notNull().default(true),
    /** review = draft + approve sends; automatic = send due steps on schedule */
    outreachAutomationMode: varchar('outreach_automation_mode', { length: 20 })
      .notNull()
      .default('review'),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('sdr_agent_configs_active_idx').on(table.isActive, table.isPaused),
  }),
)

export const sdrAspireBindings = pgTable(
  'sdr_aspire_bindings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    configId: uuid('config_id')
      .notNull()
      .references(() => sdrAgentConfigs.id, { onDelete: 'cascade' }),
    savedSearchId: uuid('saved_search_id')
      .notNull()
      .references(() => aspireSavedSearches.id, { onDelete: 'cascade' }),
    priority: smallint('priority').notNull().default(0),
    minIcpScore: smallint('min_icp_score').notNull().default(70),
    maxLeadsPerRun: smallint('max_leads_per_run').notNull().default(25),
    autoEnrollSdr: boolean('auto_enroll_sdr').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('sdr_aspire_bindings_account_idx').on(table.accountId, table.isActive),
    configIdx: index('sdr_aspire_bindings_config_idx').on(table.configId, table.priority),
    configSearchUniq: uniqueIndex('sdr_aspire_bindings_config_search_idx').on(
      table.configId,
      table.savedSearchId,
    ),
  }),
)

export const sdrSequences = pgTable(
  'sdr_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    configId: uuid('config_id')
      .notNull()
      .references(() => sdrAgentConfigs.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    aspireResultId: uuid('aspire_result_id').references(() => aspireResults.id),
    status: varchar('status', { length: 30 }).notNull().default('active'),
    currentStep: smallint('current_step').notNull().default(0),
    totalSteps: smallint('total_steps').notNull().default(5),
    nextStepAt: timestamptz('next_step_at'),
    lastStepAt: timestamptz('last_step_at'),
    repliedAt: timestamptz('replied_at'),
    replyType: varchar('reply_type', { length: 30 }),
    bookedAt: timestamptz('booked_at'),
    meetingUrl: text('meeting_url'),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountStatusIdx: index('sdr_sequences_account_status_idx').on(table.accountId, table.status),
    leadIdx: index('sdr_sequences_lead_idx').on(table.leadId, table.accountId),
  }),
)

export const sdrSequenceSteps = pgTable(
  'sdr_sequence_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sdrSequences.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    stepNumber: smallint('step_number').notNull(),
    channel: varchar('channel', { length: 20 }).notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    scheduledFor: timestamptz('scheduled_for').notNull(),
    sentAt: timestamptz('sent_at'),
    status: varchar('status', { length: 30 }).notNull().default('scheduled'),
    openedAt: timestamptz('opened_at'),
    clickedAt: timestamptz('clicked_at'),
    repliedAt: timestamptz('replied_at'),
    resendId: text('resend_id'),
    twilioSid: text('twilio_sid'),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    dueIdx: index('sdr_sequence_steps_due_idx').on(
      table.accountId,
      table.status,
      table.scheduledFor,
    ),
    resendIdx: index('sdr_sequence_steps_resend_idx').on(table.resendId),
    twilioIdx: index('sdr_sequence_steps_twilio_idx').on(table.twilioSid),
  }),
)

export const sdrActivityLog = pgTable(
  'sdr_activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    configId: uuid('config_id')
      .notNull()
      .references(() => sdrAgentConfigs.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id),
    sequenceId: uuid('sequence_id').references(() => sdrSequences.id),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('sdr_activity_log_account_idx').on(table.accountId, table.createdAt),
  }),
)

export const sdrBillingTierEnum = pgEnum('sdr_billing_tier', ['free', 'standard', 'premium'])

export const sdrCreditAccounts = pgTable('sdr_credit_accounts', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  billingTier: sdrBillingTierEnum('billing_tier').notNull().default('free'),
  usedThisPeriod: numeric('used_this_period', { precision: 12, scale: 1 }).notNull().default('0'),
  periodStart: timestamptz('period_start').notNull().defaultNow(),
  trialStartedAt: timestamptz('trial_started_at'),
  trialEndsAt: timestamptz('trial_ends_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
})

export const sdrCreditLedger = pgTable(
  'sdr_credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 40 }).notNull(),
    credits: numeric('credits', { precision: 12, scale: 1 }).notNull(),
    referenceId: varchar('reference_id', { length: 120 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('sdr_credit_ledger_account_idx').on(table.accountId, table.createdAt),
  }),
)

export const aspireSearchRuns = pgTable(
  'aspire_search_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    savedSearchId: uuid('saved_search_id').references(() => aspireSavedSearches.id),
    configId: uuid('config_id').references(() => sdrAgentConfigs.id, { onDelete: 'set null' }),
    query: jsonb('query').notNull().default({}),
    resultCount: smallint('result_count').notNull().default(0),
    enrolledCount: smallint('enrolled_count').notNull().default(0),
    status: varchar('status', { length: 20 }).notNull().default('success'),
    errorMessage: text('error_message'),
    runAt: timestamptz('run_at').notNull().defaultNow(),
    finishedAt: timestamptz('finished_at'),
  },
  (table) => ({
    accountIdx: index('aspire_search_runs_account_id_idx').on(table.accountId),
    statusIdx: index('aspire_search_runs_status_idx').on(table.accountId, table.runAt),
  }),
)

export const linkedinAccounts = pgTable(
  'linkedin_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    linkedinProfileUrl: text('linkedin_profile_url'),
    extensionConnected: boolean('extension_connected').notNull().default(false),
    extensionTokenHash: text('extension_token_hash'),
    extensionTokenPrefix: varchar('extension_token_prefix', { length: 16 }),
    extensionLastSeenAt: timestamptz('extension_last_seen_at'),
    extensionTokenRevokedAt: timestamptz('extension_token_revoked_at'),
    dailyLimit: smallint('daily_limit').notNull().default(50),
    dailySent: smallint('daily_sent').notNull().default(0),
    healthStatus: varchar('health_status', { length: 30 }).notNull().default('healthy'),
    metadata: jsonb('metadata').notNull().default({}),
    connectedAt: timestamptz('connected_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: uniqueIndex('linkedin_accounts_account_user_idx').on(table.accountId, table.userId),
  }),
)

export const linkedinCampaigns = pgTable(
  'linkedin_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: linkedinCampaignStatusEnum('status').notNull().default('active'),
    ownerId: uuid('owner_id').references(() => users.id),
    workflow: jsonb('workflow').notNull().default([]),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('linkedin_campaigns_account_id_idx').on(table.accountId),
    statusIdx: index('linkedin_campaigns_status_idx').on(table.status, table.accountId),
  }),
)

export const linkedinSequences = pgTable(
  'linkedin_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => linkedinCampaigns.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 30 }).notNull().default('active'),
    currentStep: smallint('current_step').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('linkedin_sequences_account_id_idx').on(table.accountId),
    campaignIdx: index('linkedin_sequences_campaign_id_idx').on(table.campaignId),
    leadIdx: index('linkedin_sequences_lead_id_idx').on(table.leadId),
  }),
)

export const linkedinSequenceSteps = pgTable(
  'linkedin_sequence_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => linkedinSequences.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    stepNumber: smallint('step_number').notNull(),
    nodeType: varchar('node_type', { length: 50 }).notNull(),
    channel: channelEnum('channel').notNull().default('linkedin'),
    subject: varchar('subject', { length: 500 }),
    content: text('content'),
    sendAt: timestamptz('send_at').notNull(),
    sentAt: timestamptz('sent_at'),
    status: sequenceStepStatusEnum('status').notNull().default('pending'),
    skipReason: text('skip_reason'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('linkedin_sequence_steps_account_id_idx').on(table.accountId),
    sequenceIdx: index('linkedin_sequence_steps_sequence_id_idx').on(table.sequenceId),
    statusIdx: index('linkedin_sequence_steps_status_idx').on(table.status, table.sendAt),
  }),
)

// ---------------------------------------------------------------------------
// Unified outreach campaigns (email / SMS / LinkedIn — Phase 1: email)
// ---------------------------------------------------------------------------

export const outreachCampaignGoalEnum = pgEnum('outreach_campaign_goal', [
  'book_meeting',
  'fill_funnel',
  're_engage',
])

export const outreachCampaignStatusEnum = pgEnum('outreach_campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
])

export const outreachEnrollmentStatusEnum = pgEnum('outreach_enrollment_status', [
  'active',
  'paused',
  'completed',
  'replied',
  'unsubscribed',
])

export type OutreachCampaignWorkflowStep = {
  stepIndex: number
  delayDays: number
  channel: 'email' | 'sms' | 'linkedin'
  intent: string
  subject?: string
  body: string
}

export type CampaignDeliveryMode =
  | 'sequence'
  | 'single_email'
  | 'linkedin_sequence'
  | 'single_linkedin'

export type CampaignChannelFocus = 'email' | 'linkedin'

export type ScoutAutomationCampaignMeta = {
  source: 'prospect_scout'
  aspireSearchRunId: string
  autoGenerated: true
  sequenceCount?: number
}

export type OutreachCampaignWorkflow = {
  steps: OutreachCampaignWorkflowStep[]
  /** Email: sequence | single_email. LinkedIn: linkedin_sequence | single_linkedin */
  deliveryMode?: CampaignDeliveryMode
  /** Separates email-hub campaigns from LinkedIn-hub campaigns */
  channelFocus?: CampaignChannelFocus
  /** Scout automatic mode: one campaign per discovery run with per-lead AI copy */
  automation?: ScoutAutomationCampaignMeta
}

export type OutreachCampaignMetrics = {
  enrolled: number
  sent: number
  failed: number
  replied: number
  meetings: number
}

export const outreachCampaigns = pgTable(
  'outreach_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    goal: outreachCampaignGoalEnum('goal').notNull().default('book_meeting'),
    status: outreachCampaignStatusEnum('status').notNull().default('draft'),
    channels: jsonb('channels').notNull().default(['email']),
    workflow: jsonb('workflow').notNull().default({ steps: [] }),
    metrics: jsonb('metrics').notNull().default({
      enrolled: 0,
      sent: 0,
      failed: 0,
      replied: 0,
      meetings: 0,
    }),
    ownerId: uuid('owner_id').references(() => users.id),
    launchedAt: timestamptz('launched_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('outreach_campaigns_account_id_idx').on(table.accountId),
    statusIdx: index('outreach_campaigns_status_idx').on(table.status, table.accountId),
  }),
)

export const outreachAgentConfigs = pgTable(
  'outreach_agent_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .unique()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull().default('Outreach Agent'),
    linkedCampaignIds: jsonb('linked_campaign_ids').notNull().default([]),
    isActive: boolean('is_active').notNull().default(false),
    isPaused: boolean('is_paused').notNull().default(false),
    pausedReason: text('paused_reason'),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('outreach_agent_configs_active_idx').on(table.isActive, table.isPaused),
  }),
)

export const outreachCampaignEnrollments = pgTable(
  'outreach_campaign_enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    status: outreachEnrollmentStatusEnum('status').notNull().default('active'),
    enrolledAt: timestamptz('enrolled_at').notNull().defaultNow(),
    pausedAt: timestamptz('paused_at'),
    completedAt: timestamptz('completed_at'),
    repliedAt: timestamptz('replied_at'),
    meetingBookedAt: timestamptz('meeting_booked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('outreach_enrollments_account_id_idx').on(table.accountId),
    campaignIdx: index('outreach_enrollments_campaign_id_idx').on(table.campaignId),
    leadIdx: index('outreach_enrollments_lead_id_idx').on(table.leadId),
    uniqueLead: uniqueIndex('outreach_enrollments_campaign_lead_idx').on(
      table.campaignId,
      table.leadId,
    ),
  }),
)

export const outreachCampaignSteps = pgTable(
  'outreach_campaign_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => outreachCampaignEnrollments.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    stepIndex: smallint('step_index').notNull(),
    channel: channelEnum('channel').notNull().default('email'),
    subject: varchar('subject', { length: 500 }),
    body: text('body').notNull(),
    sendAt: timestamptz('send_at').notNull(),
    sentAt: timestamptz('sent_at'),
    status: sequenceStepStatusEnum('status').notNull().default('pending'),
    skipReason: text('skip_reason'),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('outreach_campaign_steps_account_id_idx').on(table.accountId),
    campaignIdx: index('outreach_campaign_steps_campaign_id_idx').on(table.campaignId),
    enrollmentIdx: index('outreach_campaign_steps_enrollment_id_idx').on(table.enrollmentId),
    statusIdx: index('outreach_campaign_steps_status_idx').on(table.status, table.sendAt),
  }),
)

// ---------------------------------------------------------------------------
// AI brain — persistent memory and append-only observation log.
//
// `ai_memory` is the "brain". One row per (account, kind, subject) holds a
// distilled summary plus structured evidence. Rows are upserted: when new
// information arrives, the workflow that owns that kind re-summarizes and
// bumps `version`. `confidence` is 0..100 and reflects the model's stated
// confidence in the summary.
//
// `ai_observations` is the append-only event log feeding the learning loop.
// Every AI-relevant action (signal generated, message drafted, recommendation
// dismissed, prediction outcome) is recorded here so future workflows can
// look back at what worked and tighten prompts.

export const aiMemoryKindEnum = pgEnum('ai_memory_kind', [
  'business_context',
  'contact_memory',
  'record_memory',
  'pattern',
  'preference',
])

export const aiObservationKindEnum = pgEnum('ai_observation_kind', [
  'tool_called',
  'signal_generated',
  'signal_dismissed',
  'message_drafted',
  'message_sent',
  'recommendation_accepted',
  'recommendation_dismissed',
  'prediction_made',
  'prediction_outcome',
])

export const aiMemory = pgTable(
  'ai_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: aiMemoryKindEnum('kind').notNull(),
    // For account-level memory: subjectType='account', subjectId=accountId.
    // For per-contact memory: subjectType='contact', subjectId=contacts.id.
    // For per-record memory:  subjectType='record',  subjectId=records.id.
    subjectType: varchar('subject_type', { length: 30 }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    summary: text('summary').notNull(),
    evidence: jsonb('evidence').notNull().default({}),
    confidence: smallint('confidence').notNull().default(50),
    version: smallint('version').notNull().default(1),
    modelUsed: varchar('model_used', { length: 80 }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // One row per unique (account, kind, subject). Re-running a workflow
    // replaces the summary rather than appending.
    uniqueMemory: uniqueIndex('ai_memory_account_kind_subject_idx').on(
      table.accountId,
      table.kind,
      table.subjectType,
      table.subjectId,
    ),
    accountIdx: index('ai_memory_account_id_idx').on(table.accountId),
    kindIdx: index('ai_memory_kind_account_idx').on(table.kind, table.accountId),
  }),
)

export const aiObservations = pgTable(
  'ai_observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: aiObservationKindEnum('kind').notNull(),
    // Free-form context: which tool ran, what input, what came back, what
    // happened next. Outcome is null until the loop closes (e.g. a message
    // gets a reply, a signal gets actioned).
    payload: jsonb('payload').notNull().default({}),
    outcome: varchar('outcome', { length: 30 }),
    relatedAutomationId: uuid('related_automation_id').references(() => automations.id),
    relatedRecordId: uuid('related_record_id').references(() => records.id),
    relatedContactId: uuid('related_contact_id').references(() => contacts.id),
    relatedSignalId: uuid('related_signal_id').references(() => intelligenceSignals.id),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('ai_observations_account_id_idx').on(table.accountId),
    kindIdx: index('ai_observations_kind_account_idx').on(table.kind, table.accountId),
    occurredIdx: index('ai_observations_occurred_at_idx').on(table.occurredAt),
  }),
)

export const accountsRelations = relations(accounts, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  records: many(records),
  automations: many(automations),
  leads: many(leads),
  linkedinCampaigns: many(linkedinCampaigns),
}))

export const usersRelations = relations(users, ({ one }) => ({
  account: one(accounts, {
    fields: [users.accountId],
    references: [accounts.id],
  }),
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  account: one(accounts, {
    fields: [contacts.accountId],
    references: [accounts.id],
  }),
  records: many(records),
  activities: many(activities),
  messages: many(messages),
  invoices: many(invoices),
}))

export const stageDefinitionsRelations = relations(stageDefinitions, ({ one, many }) => ({
  account: one(accounts, {
    fields: [stageDefinitions.accountId],
    references: [accounts.id],
  }),
  records: many(records),
}))

export const recordsRelations = relations(records, ({ one, many }) => ({
  account: one(accounts, {
    fields: [records.accountId],
    references: [accounts.id],
  }),
  contact: one(contacts, {
    fields: [records.contactId],
    references: [contacts.id],
  }),
  stage: one(stageDefinitions, {
    fields: [records.stageId],
    references: [stageDefinitions.id],
  }),
  assignedUser: one(users, {
    fields: [records.assignedUserId],
    references: [users.id],
  }),
  activities: many(activities),
  messages: many(messages),
  invoices: many(invoices),
  documents: many(documents),
}))

export const activitiesRelations = relations(activities, ({ one }) => ({
  account: one(accounts, {
    fields: [activities.accountId],
    references: [accounts.id],
  }),
  record: one(records, {
    fields: [activities.recordId],
    references: [records.id],
  }),
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id],
  }),
}))

export const automationsRelations = relations(automations, ({ one, many }) => ({
  account: one(accounts, {
    fields: [automations.accountId],
    references: [accounts.id],
  }),
  runs: many(automationRuns),
}))

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  account: one(accounts, {
    fields: [automationRuns.accountId],
    references: [accounts.id],
  }),
  automation: one(automations, {
    fields: [automationRuns.automationId],
    references: [automations.id],
  }),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  account: one(accounts, {
    fields: [messages.accountId],
    references: [accounts.id],
  }),
  record: one(records, {
    fields: [messages.recordId],
    references: [records.id],
  }),
  contact: one(contacts, {
    fields: [messages.contactId],
    references: [contacts.id],
  }),
  automation: one(automations, {
    fields: [messages.automationId],
    references: [automations.id],
  }),
}))

export const invoicesRelations = relations(invoices, ({ one }) => ({
  account: one(accounts, {
    fields: [invoices.accountId],
    references: [accounts.id],
  }),
  record: one(records, {
    fields: [invoices.recordId],
    references: [records.id],
  }),
  contact: one(contacts, {
    fields: [invoices.contactId],
    references: [contacts.id],
  }),
}))

export const documentsRelations = relations(documents, ({ one }) => ({
  account: one(accounts, {
    fields: [documents.accountId],
    references: [accounts.id],
  }),
  record: one(records, {
    fields: [documents.recordId],
    references: [records.id],
  }),
  contact: one(contacts, {
    fields: [documents.contactId],
    references: [contacts.id],
  }),
  signerContact: one(contacts, {
    fields: [documents.signerContactId],
    references: [contacts.id],
  }),
}))

export const intelligenceSignalsRelations = relations(intelligenceSignals, ({ one }) => ({
  account: one(accounts, {
    fields: [intelligenceSignals.accountId],
    references: [accounts.id],
  }),
  record: one(records, {
    fields: [intelligenceSignals.recordId],
    references: [records.id],
  }),
  contact: one(contacts, {
    fields: [intelligenceSignals.contactId],
    references: [contacts.id],
  }),
  dismissedByUser: one(users, {
    fields: [intelligenceSignals.dismissedByUserId],
    references: [users.id],
  }),
}))

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  account: one(accounts, {
    fields: [featureFlags.accountId],
    references: [accounts.id],
  }),
}))

export const integrationCredentialsRelations = relations(integrationCredentials, ({ one }) => ({
  account: one(accounts, {
    fields: [integrationCredentials.accountId],
    references: [accounts.id],
  }),
}))

export const aiMemoryRelations = relations(aiMemory, ({ one }) => ({
  account: one(accounts, {
    fields: [aiMemory.accountId],
    references: [accounts.id],
  }),
}))

export const aiObservationsRelations = relations(aiObservations, ({ one }) => ({
  account: one(accounts, {
    fields: [aiObservations.accountId],
    references: [accounts.id],
  }),
  automation: one(automations, {
    fields: [aiObservations.relatedAutomationId],
    references: [automations.id],
  }),
  record: one(records, {
    fields: [aiObservations.relatedRecordId],
    references: [records.id],
  }),
  contact: one(contacts, {
    fields: [aiObservations.relatedContactId],
    references: [contacts.id],
  }),
  signal: one(intelligenceSignals, {
    fields: [aiObservations.relatedSignalId],
    references: [intelligenceSignals.id],
  }),
}))

export const leadsRelations = relations(leads, ({ one, many }) => ({
  account: one(accounts, {
    fields: [leads.accountId],
    references: [accounts.id],
  }),
  owner: one(users, {
    fields: [leads.ownerId],
    references: [users.id],
  }),
  convertedContact: one(contacts, {
    fields: [leads.convertedContactId],
    references: [contacts.id],
  }),
  profile: one(leadProfiles, {
    fields: [leads.id],
    references: [leadProfiles.leadId],
  }),
  sequences: many(linkedinSequences),
  sdrSequences: many(sdrSequences),
  activities: many(activities),
}))

export const leadProfilesRelations = relations(leadProfiles, ({ one }) => ({
  account: one(accounts, {
    fields: [leadProfiles.accountId],
    references: [accounts.id],
  }),
  lead: one(leads, {
    fields: [leadProfiles.leadId],
    references: [leads.id],
  }),
}))

export const linkedinCampaignsRelations = relations(linkedinCampaigns, ({ one, many }) => ({
  account: one(accounts, {
    fields: [linkedinCampaigns.accountId],
    references: [accounts.id],
  }),
  owner: one(users, {
    fields: [linkedinCampaigns.ownerId],
    references: [users.id],
  }),
  sequences: many(linkedinSequences),
}))

export const linkedinSequencesRelations = relations(linkedinSequences, ({ one, many }) => ({
  account: one(accounts, {
    fields: [linkedinSequences.accountId],
    references: [accounts.id],
  }),
  campaign: one(linkedinCampaigns, {
    fields: [linkedinSequences.campaignId],
    references: [linkedinCampaigns.id],
  }),
  lead: one(leads, {
    fields: [linkedinSequences.leadId],
    references: [leads.id],
  }),
  steps: many(linkedinSequenceSteps),
}))

export const linkedinSequenceStepsRelations = relations(linkedinSequenceSteps, ({ one }) => ({
  account: one(accounts, {
    fields: [linkedinSequenceSteps.accountId],
    references: [accounts.id],
  }),
  sequence: one(linkedinSequences, {
    fields: [linkedinSequenceSteps.sequenceId],
    references: [linkedinSequences.id],
  }),
  lead: one(leads, {
    fields: [linkedinSequenceSteps.leadId],
    references: [leads.id],
  }),
}))

export const outreachCampaignsRelations = relations(outreachCampaigns, ({ one, many }) => ({
  account: one(accounts, {
    fields: [outreachCampaigns.accountId],
    references: [accounts.id],
  }),
  owner: one(users, {
    fields: [outreachCampaigns.ownerId],
    references: [users.id],
  }),
  enrollments: many(outreachCampaignEnrollments),
  steps: many(outreachCampaignSteps),
}))

export const outreachCampaignEnrollmentsRelations = relations(
  outreachCampaignEnrollments,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [outreachCampaignEnrollments.accountId],
      references: [accounts.id],
    }),
    campaign: one(outreachCampaigns, {
      fields: [outreachCampaignEnrollments.campaignId],
      references: [outreachCampaigns.id],
    }),
    lead: one(leads, {
      fields: [outreachCampaignEnrollments.leadId],
      references: [leads.id],
    }),
    steps: many(outreachCampaignSteps),
  }),
)

export const outreachCampaignStepsRelations = relations(outreachCampaignSteps, ({ one }) => ({
  account: one(accounts, {
    fields: [outreachCampaignSteps.accountId],
    references: [accounts.id],
  }),
  campaign: one(outreachCampaigns, {
    fields: [outreachCampaignSteps.campaignId],
    references: [outreachCampaigns.id],
  }),
  enrollment: one(outreachCampaignEnrollments, {
    fields: [outreachCampaignSteps.enrollmentId],
    references: [outreachCampaignEnrollments.id],
  }),
  lead: one(leads, {
    fields: [outreachCampaignSteps.leadId],
    references: [leads.id],
  }),
}))

export const sdrAgentConfigsRelations = relations(sdrAgentConfigs, ({ one, many }) => ({
  account: one(accounts, {
    fields: [sdrAgentConfigs.accountId],
    references: [accounts.id],
  }),
  sequences: many(sdrSequences),
  activityLog: many(sdrActivityLog),
  aspireBindings: many(sdrAspireBindings),
}))

export const sdrAspireBindingsRelations = relations(sdrAspireBindings, ({ one }) => ({
  account: one(accounts, {
    fields: [sdrAspireBindings.accountId],
    references: [accounts.id],
  }),
  config: one(sdrAgentConfigs, {
    fields: [sdrAspireBindings.configId],
    references: [sdrAgentConfigs.id],
  }),
  savedSearch: one(aspireSavedSearches, {
    fields: [sdrAspireBindings.savedSearchId],
    references: [aspireSavedSearches.id],
  }),
}))

export const sdrSequencesRelations = relations(sdrSequences, ({ one, many }) => ({
  account: one(accounts, {
    fields: [sdrSequences.accountId],
    references: [accounts.id],
  }),
  config: one(sdrAgentConfigs, {
    fields: [sdrSequences.configId],
    references: [sdrAgentConfigs.id],
  }),
  lead: one(leads, {
    fields: [sdrSequences.leadId],
    references: [leads.id],
  }),
  aspireResult: one(aspireResults, {
    fields: [sdrSequences.aspireResultId],
    references: [aspireResults.id],
  }),
  steps: many(sdrSequenceSteps),
}))

export const sdrSequenceStepsRelations = relations(sdrSequenceSteps, ({ one }) => ({
  account: one(accounts, {
    fields: [sdrSequenceSteps.accountId],
    references: [accounts.id],
  }),
  sequence: one(sdrSequences, {
    fields: [sdrSequenceSteps.sequenceId],
    references: [sdrSequences.id],
  }),
  lead: one(leads, {
    fields: [sdrSequenceSteps.leadId],
    references: [leads.id],
  }),
}))

export const sdrActivityLogRelations = relations(sdrActivityLog, ({ one }) => ({
  account: one(accounts, {
    fields: [sdrActivityLog.accountId],
    references: [accounts.id],
  }),
  config: one(sdrAgentConfigs, {
    fields: [sdrActivityLog.configId],
    references: [sdrAgentConfigs.id],
  }),
  lead: one(leads, {
    fields: [sdrActivityLog.leadId],
    references: [leads.id],
  }),
  sequence: one(sdrSequences, {
    fields: [sdrActivityLog.sequenceId],
    references: [sdrSequences.id],
  }),
}))

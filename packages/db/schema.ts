import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  bigint,
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

export const channelEnum = pgEnum('channel', ['sms', 'email', 'portal'])

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
  timezone: varchar('timezone', { length: 60 }).notNull().default('America/Los_Angeles'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  onboardingCompletedAt: timestamptz('onboarding_completed_at'),

  // Personalization profile (used by `personalizeTemplate` at apply time).
  // All optional — falls back to portal-URL defaults when null.
  bookingLink: text('booking_link'),
  reviewLink: text('review_link'),
  paymentLink: text('payment_link'),
  emergencyLine: varchar('emergency_line', { length: 50 }),
  businessHoursStart: smallint('business_hours_start'),
  businessHoursEnd: smallint('business_hours_end'),
  voicePreference: varchar('voice_preference', { length: 20 }),

  // Tracks which template was applied so integration-connect flows can
  // re-run personalization against the current profile.
  activeTemplateId: uuid('active_template_id'),

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
    portalLastLoginAt: timestamptz('portal_last_login_at'),
    ltvCents: bigint('ltv_cents', { mode: 'number' }).notNull().default(0),
    churnRiskScore: smallint('churn_risk_score').notNull().default(0),
    upsellScore: smallint('upsell_score').notNull().default(0),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    source: varchar('source', { length: 100 }),
    notes: text('notes'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => ({
    accountIdx: index('contacts_account_id_idx').on(table.accountId),
    emailAccountIdx: index('contacts_email_account_idx').on(table.email, table.accountId),
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

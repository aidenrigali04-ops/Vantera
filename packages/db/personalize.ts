// Template personalization engine.
//
// Takes a raw vertical template (as stored in `vertical_templates.template_data`)
// plus an `OnboardingProfile` derived from the account, owner, and connected
// integrations, and returns a personalized copy of the template:
//
//   1. Variable substitution — replaces `{{business_name}}`, `{{owner_first_name}}`,
//      `{{portal_url}}`, etc. in `templateBody`, `subject`, and `title` fields.
//      Unknown placeholders (like `{{contact.first_name}}`) are *preserved* so
//      they can be filled in at message-send time against the real record.
//
//   2. Channel reconciliation — if an automation wants to send an SMS but the
//      account hasn't connected Twilio, the action is either:
//         (a) downgraded to email (if email is supported), or
//         (b) dropped from the action list entirely.
//      Automations whose entire action list collapses to empty are removed.
//
//   3. Voice tone — when the profile carries a `voice` preference, each action's
//      `templateBody` is wrapped with a voice-specific prefix iff the body is
//      a plain literal (no leading {{var}}).
//
//   4. Trigger personalization — `outside_business_hours` style conditions
//      receive concrete business-hour windows derived from the profile.
//
// The engine is pure: same input → same output, no I/O, no time dependence.
// It runs inside `applyVerticalTemplate` so personalization happens once at
// onboarding-apply time and the resulting rows live in `automations` /
// `stage_definitions`. Re-running the action re-applies a fresh personalization.

export type Channel = 'sms' | 'email' | 'portal'

export type VoiceTone = 'friendly' | 'professional' | 'urgent'

export type SupportedChannels = {
  sms: boolean
  email: boolean
  portal: boolean
}

export type OnboardingProfile = {
  // Identity
  businessName: string
  businessSlug: string
  ownerFullName: string | null
  ownerFirstName: string | null
  ownerEmail: string | null

  // Branding
  brandPrimaryColor: string
  portalDomain: string | null
  portalUrl: string
  appBaseUrl: string

  // Capabilities (driven by which integrations are connected)
  supportedChannels: SupportedChannels
  twilioPhoneNumber: string | null
  hasStripe: boolean

  // Preferences (optional — sensible defaults applied if omitted)
  timezone: string
  voice?: VoiceTone
  businessHoursStart?: number // 0–23 in local time
  businessHoursEnd?: number   // 0–23 in local time
  emergencyLine?: string

  // Pre-computed action links (optional — falls back to portal URL if omitted)
  bookingLink?: string
  reviewLink?: string
  paymentLink?: string
}

export type TemplateStage = {
  recordType?: string
  label: string
  position: number
  color?: string
  triggersAutomation?: boolean
  isTerminalWin?: boolean
  isTerminalLoss?: boolean
}

export type TemplateAction = {
  type: string
  channel?: string
  templateBody?: string
  subject?: string
  title?: string
  delayMinutes?: number
  assignedUserId?: string
  [extra: string]: unknown
}

export type TemplateAutomation = {
  name: string
  triggerEvent: string
  triggerConditions?: Record<string, unknown>
  actions?: TemplateAction[]
  templateRef?: string
}

export type VerticalTemplateData = {
  description?: string
  stages: TemplateStage[]
  automations?: TemplateAutomation[]
}

const VOICE_PREFIX: Record<VoiceTone, string> = {
  friendly: 'Hey {{contact.first_name}}! ',
  professional: 'Hi {{contact.first_name}}, ',
  urgent: 'URGENT — ',
}

const SUBSTITUTABLE_FIELDS = ['templateBody', 'subject', 'title'] as const

const SMS_LIKE_TYPES = new Set(['send_sms', 'sms', 'text'])
const EMAIL_LIKE_TYPES = new Set(['send_email', 'email'])
const PORTAL_LIKE_TYPES = new Set(['send_portal_notification', 'portal_notification'])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function personalizeTemplate(
  data: VerticalTemplateData,
  profile: OnboardingProfile,
): VerticalTemplateData {
  const automations = (data.automations ?? [])
    .map((automation) => personalizeAutomation(automation, profile))
    .filter((automation): automation is TemplateAutomation => automation !== null)

  return {
    ...data,
    stages: data.stages,
    automations,
  }
}

// Exposed for unit-style assertions and for callers that want to render
// templates against the profile at message-send time (without re-running
// the whole personalization pass).
export function applySubstitutions(input: string, profile: OnboardingProfile): string {
  const substitutions = buildSubstitutionMap(profile)
  return input.replace(/\{\{([a-z0-9_.]+)\}\}/gi, (match, rawKey: string) => {
    const key = rawKey.toLowerCase()
    if (key in substitutions) {
      return substitutions[key] ?? match
    }
    // Preserve unknown placeholders for runtime substitution against
    // the actual record/contact at message-send time.
    return match
  })
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function personalizeAutomation(
  automation: TemplateAutomation,
  profile: OnboardingProfile,
): TemplateAutomation | null {
  const personalizedActions = (automation.actions ?? [])
    .map((action) => personalizeAction(action, profile))
    .filter((action): action is TemplateAction => action !== null)

  // If every action collapsed (e.g. SMS-only automation on an email-only
  // account with no fallback), drop the automation entirely.
  if (personalizedActions.length === 0 && (automation.actions ?? []).length > 0) {
    return null
  }

  return {
    ...automation,
    actions: personalizedActions,
    triggerConditions: personalizeTriggerConditions(automation.triggerConditions, profile),
  }
}

function personalizeAction(
  action: TemplateAction,
  profile: OnboardingProfile,
): TemplateAction | null {
  const channelTarget = channelForActionType(action.type, action.channel)
  let normalized: TemplateAction = action

  if (channelTarget && !profile.supportedChannels[channelTarget]) {
    const fallback = pickFallbackChannel(channelTarget, profile)
    if (!fallback) {
      // No channel available — drop this action.
      return null
    }

    normalized = retargetAction(action, fallback)
  }

  // Apply voice prefix BEFORE substitution so voice prefixes can themselves
  // contain placeholders (e.g. "{{contact.first_name}}").
  normalized = applyVoice(normalized, profile)

  // Variable substitution across substitutable fields.
  for (const field of SUBSTITUTABLE_FIELDS) {
    const value = normalized[field]
    if (typeof value === 'string' && value.length > 0) {
      normalized = { ...normalized, [field]: applySubstitutions(value, profile) }
    }
  }

  // Default assignedUserId is left for the action runtime (we don't have a
  // user id reliably available here; the runtime can pick the owner).

  return normalized
}

function personalizeTriggerConditions(
  conditions: Record<string, unknown> | undefined,
  profile: OnboardingProfile,
): Record<string, unknown> {
  if (!conditions) return {}

  const next: Record<string, unknown> = { ...conditions }

  if (
    next.outside_business_hours === true &&
    typeof profile.businessHoursStart === 'number' &&
    typeof profile.businessHoursEnd === 'number'
  ) {
    next.business_hours = {
      start: profile.businessHoursStart,
      end: profile.businessHoursEnd,
      timezone: profile.timezone,
    }
  }

  return next
}

function channelForActionType(type: string, channel?: string): Channel | null {
  if (channel === 'sms' || SMS_LIKE_TYPES.has(type)) return 'sms'
  if (channel === 'email' || EMAIL_LIKE_TYPES.has(type)) return 'email'
  if (channel === 'portal' || PORTAL_LIKE_TYPES.has(type)) return 'portal'
  return null
}

function pickFallbackChannel(missing: Channel, profile: OnboardingProfile): Channel | null {
  // Hand-tuned preference order keyed by the *requested* channel.
  const order: Record<Channel, Channel[]> = {
    sms: ['email', 'portal'],
    email: ['portal'],
    portal: ['email'],
  }

  for (const candidate of order[missing]) {
    if (profile.supportedChannels[candidate]) return candidate
  }
  return null
}

function retargetAction(action: TemplateAction, channel: Channel): TemplateAction {
  const nextType =
    channel === 'sms' ? 'send_sms' : channel === 'email' ? 'send_email' : 'send_portal_notification'

  const next: TemplateAction = { ...action, type: nextType, channel }

  // When downgrading SMS → email we lift the SMS body up into the email's
  // subject preview if no subject was set, so something legible still ships.
  if (channel === 'email' && !next.subject && typeof next.templateBody === 'string') {
    const trimmed = next.templateBody.trim()
    next.subject = trimmed.length > 80 ? `${trimmed.slice(0, 77).trim()}…` : trimmed
  }

  return next
}

function applyVoice(action: TemplateAction, profile: OnboardingProfile): TemplateAction {
  if (!profile.voice) return action
  if (typeof action.templateBody !== 'string' || action.templateBody.length === 0) return action

  const prefix = VOICE_PREFIX[profile.voice]
  // Don't re-prefix if the body already opens with a {{ placeholder — the
  // template author has explicitly chosen the opening tone.
  if (action.templateBody.trimStart().startsWith('{{')) return action

  return { ...action, templateBody: `${prefix}${action.templateBody}` }
}

function buildSubstitutionMap(profile: OnboardingProfile): Record<string, string> {
  const ownerFirst =
    profile.ownerFirstName ?? profile.ownerFullName?.split(/\s+/)[0] ?? profile.businessName
  const ownerName = profile.ownerFullName ?? profile.businessName
  const portalUrl = profile.portalUrl

  return {
    business_name: profile.businessName,
    business_slug: profile.businessSlug,
    owner_first_name: ownerFirst,
    owner_full_name: ownerName,
    owner_email: profile.ownerEmail ?? '',
    'assigned_user.name': ownerName,
    'assigned_user.first_name': ownerFirst,
    portal_url: portalUrl,
    app_base_url: profile.appBaseUrl,
    booking_link: profile.bookingLink ?? `${portalUrl}/book`,
    review_link: profile.reviewLink ?? `${portalUrl}/review`,
    payment_link: profile.paymentLink ?? `${portalUrl}/pay`,
    emergency_line: profile.emergencyLine ?? 'our emergency line',
    primary_color: profile.brandPrimaryColor,
    timezone: profile.timezone,
  }
}

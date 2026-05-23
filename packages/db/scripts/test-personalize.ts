// Smoke-test for the template personalization engine.
//
// Validates the four primary behaviors without hitting the database:
//   1. Variable substitution into templateBody/subject/title
//   2. SMS → email downgrade when Twilio is not connected
//   3. Action drop + automation drop when no usable channel remains
//   4. Unknown placeholders (e.g. {{contact.first_name}}) are preserved
//   5. Voice prefixes are applied before substitution

import {
  applySubstitutions,
  personalizeTemplate,
  type OnboardingProfile,
  type VerticalTemplateData,
} from '../personalize.js'

let failures = 0

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const FULL_PROFILE: OnboardingProfile = {
  businessName: 'Northwind HVAC',
  businessSlug: 'northwind',
  ownerFullName: 'Aiden Rigali',
  ownerFirstName: 'Aiden',
  ownerEmail: 'aiden@northwind.example',
  brandPrimaryColor: '#1648A0',
  portalDomain: null,
  portalUrl: 'https://northwind.vantera.app',
  appBaseUrl: 'https://vantera.app',
  supportedChannels: { sms: true, email: true, portal: true },
  twilioPhoneNumber: '+15555550100',
  hasStripe: true,
  timezone: 'America/Los_Angeles',
  voice: 'professional',
  businessHoursStart: 8,
  businessHoursEnd: 18,
  emergencyLine: '+1 (555) 555-0911',
}

const NO_SMS_PROFILE: OnboardingProfile = {
  ...FULL_PROFILE,
  supportedChannels: { sms: false, email: true, portal: true },
  twilioPhoneNumber: null,
}

const EMAIL_ONLY_PROFILE: OnboardingProfile = {
  ...FULL_PROFILE,
  supportedChannels: { sms: false, email: true, portal: false },
  twilioPhoneNumber: null,
  voice: undefined,
}

const PORTAL_ONLY_PROFILE: OnboardingProfile = {
  ...FULL_PROFILE,
  supportedChannels: { sms: false, email: false, portal: true },
  twilioPhoneNumber: null,
  voice: undefined,
}

// ---------------------------------------------------------------------------

console.log('\n1. applySubstitutions')
{
  const out = applySubstitutions(
    'Thanks {{contact.first_name}} — call {{owner_first_name}} at {{business_name}}',
    FULL_PROFILE,
  )
  check('substitutes known {{owner_first_name}}', out.includes('Aiden'))
  check('substitutes known {{business_name}}', out.includes('Northwind HVAC'))
  check('preserves unknown {{contact.first_name}}', out.includes('{{contact.first_name}}'))
}

console.log('\n2. Variable substitution inside personalizeTemplate')
{
  const template: VerticalTemplateData = {
    stages: [{ label: 'New', position: 1 }],
    automations: [
      {
        name: 'welcome',
        triggerEvent: 'record_created',
        triggerConditions: {},
        actions: [
          {
            type: 'send_sms',
            channel: 'sms',
            templateBody: 'Hi from {{business_name}} — {{owner_first_name}}',
          },
          {
            type: 'send_email',
            channel: 'email',
            subject: 'Welcome to {{business_name}}',
          },
        ],
        templateRef: 'welcome',
      },
    ],
  }

  const out = personalizeTemplate(template, FULL_PROFILE)
  const sms = out.automations?.[0]?.actions?.[0]
  const email = out.automations?.[0]?.actions?.[1]
  check(
    'SMS body has business name',
    typeof sms?.templateBody === 'string' && sms.templateBody.includes('Northwind HVAC'),
  )
  check(
    'Email subject has business name',
    typeof email?.subject === 'string' && email.subject.includes('Northwind HVAC'),
  )
}

console.log('\n3. SMS → email downgrade when Twilio not connected')
{
  const template: VerticalTemplateData = {
    stages: [{ label: 'New', position: 1 }],
    automations: [
      {
        name: 'job_confirmation',
        triggerEvent: 'stage_changed',
        triggerConditions: { toStage: 'Scheduled' },
        actions: [
          { type: 'send_sms', channel: 'sms', templateBody: 'Confirmed for {{business_name}}' },
        ],
        templateRef: 'job_confirmation',
      },
    ],
  }

  const out = personalizeTemplate(template, NO_SMS_PROFILE)
  const downgraded = out.automations?.[0]?.actions?.[0]
  check('Downgraded type is send_email', downgraded?.type === 'send_email')
  check('Downgraded channel is email', downgraded?.channel === 'email')
  check(
    'Downgraded action gets a synthesized subject',
    typeof downgraded?.subject === 'string' && downgraded.subject.length > 0,
  )
  check(
    'Downgraded body still substitutes',
    typeof downgraded?.templateBody === 'string' &&
      downgraded.templateBody.includes('Northwind HVAC'),
  )
}

console.log('\n4. Automation dropped when no fallback channel exists')
{
  const template: VerticalTemplateData = {
    stages: [{ label: 'New', position: 1 }],
    automations: [
      {
        name: 'sms_only',
        triggerEvent: 'missed_call',
        triggerConditions: {},
        actions: [{ type: 'send_sms', channel: 'sms', templateBody: 'hi' }],
        templateRef: 'sms_only',
      },
      {
        name: 'portal_works',
        triggerEvent: 'stage_changed',
        triggerConditions: {},
        actions: [{ type: 'send_portal_notification', channel: 'portal', templateBody: 'hi' }],
        templateRef: 'portal_works',
      },
    ],
  }

  // SMS automation: no SMS, no email, has portal → SMS should downgrade to portal (per pickFallbackChannel order).
  // To test the *drop* path we need a profile with sms-only desire AND no fallback.
  const noChannelsProfile: OnboardingProfile = {
    ...PORTAL_ONLY_PROFILE,
    supportedChannels: { sms: false, email: false, portal: false },
  }
  const out = personalizeTemplate(template, noChannelsProfile)
  check('All automations dropped when zero channels connected', (out.automations ?? []).length === 0)
}

console.log('\n5. Voice prefixes')
{
  const template: VerticalTemplateData = {
    stages: [{ label: 'New', position: 1 }],
    automations: [
      {
        name: 'plain',
        triggerEvent: 'record_created',
        triggerConditions: {},
        actions: [
          { type: 'send_sms', channel: 'sms', templateBody: 'Welcome aboard.' },
          {
            type: 'send_sms',
            channel: 'sms',
            templateBody: '{{contact.first_name}} — explicit opening, do not prefix.',
          },
        ],
        templateRef: 'plain',
      },
    ],
  }

  const friendlyOut = personalizeTemplate(template, { ...FULL_PROFILE, voice: 'friendly' })
  const urgentOut = personalizeTemplate(template, { ...FULL_PROFILE, voice: 'urgent' })
  const noneOut = personalizeTemplate(template, { ...FULL_PROFILE, voice: undefined })

  const friendlyAction = friendlyOut.automations?.[0]?.actions?.[0]
  const friendlyExplicit = friendlyOut.automations?.[0]?.actions?.[1]
  const urgentAction = urgentOut.automations?.[0]?.actions?.[0]
  const noneAction = noneOut.automations?.[0]?.actions?.[0]

  check(
    'Friendly prefix injected on plain body',
    typeof friendlyAction?.templateBody === 'string' &&
      friendlyAction.templateBody.startsWith('Hey '),
  )
  check(
    'Friendly prefix NOT applied to body that already opens with {{var}}',
    typeof friendlyExplicit?.templateBody === 'string' &&
      friendlyExplicit.templateBody.startsWith('{{contact.first_name}}'),
  )
  check(
    'Urgent prefix injected on plain body',
    typeof urgentAction?.templateBody === 'string' &&
      urgentAction.templateBody.startsWith('URGENT'),
  )
  check(
    'No voice → body unchanged',
    typeof noneAction?.templateBody === 'string' && noneAction.templateBody === 'Welcome aboard.',
  )
}

console.log('\n6. Trigger conditions get business hours injected')
{
  const template: VerticalTemplateData = {
    stages: [{ label: 'New', position: 1 }],
    automations: [
      {
        name: 'after_hours',
        triggerEvent: 'missed_call',
        triggerConditions: { outside_business_hours: true },
        actions: [{ type: 'send_sms', channel: 'sms', templateBody: 'We are closed.' }],
        templateRef: 'after_hours',
      },
    ],
  }

  const out = personalizeTemplate(template, FULL_PROFILE)
  const cond = out.automations?.[0]?.triggerConditions as
    | { business_hours?: { start: number; end: number; timezone: string } }
    | undefined
  check('Business hours injected when outside_business_hours = true', cond?.business_hours?.start === 8)
  check('Business hours include timezone', cond?.business_hours?.timezone === 'America/Los_Angeles')
}

console.log(`\n${failures === 0 ? '✓ All personalization checks passed.' : `✗ ${failures} check(s) failed.`}`)
process.exit(failures === 0 ? 0 : 1)

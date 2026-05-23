import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { verticalTemplates } from '../schema.js'

const COLOR = {
  blue: '#3B82F6',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  green: '#10B981',
  red: '#EF4444',
  slate: '#64748B',
} as const

type StageFlags = Partial<{
  triggersAutomation: boolean
  isTerminalWin: boolean
  isTerminalLoss: boolean
}>

type Stage = {
  label: string
  position: number
  color: string
  triggersAutomation: boolean
  isTerminalWin: boolean
  isTerminalLoss: boolean
}

type Action = {
  type: string
  channel?: string
  templateBody?: string
  delayMinutes?: number
  assignedUserId?: string
  subject?: string
  title?: string
}

type Automation = {
  name: string
  triggerEvent: string
  triggerConditions: Record<string, unknown>
  actions: Action[]
  templateRef: string
}

type TemplateData = {
  stages: Stage[]
  automations: Automation[]
}

type VerticalName =
  | 'agency'
  | 'hvac'
  | 'landscaping'
  | 'plumbing'
  | 'construction'
  | 'property_mgmt'
  | 'real_estate'

type TemplateRow = {
  vertical: VerticalName
  recordType: string
  templateData: TemplateData
}

function stage(label: string, position: number, color: string, flags: StageFlags = {}): Stage {
  return {
    label,
    position,
    color,
    triggersAutomation: flags.triggersAutomation ?? false,
    isTerminalWin: flags.isTerminalWin ?? false,
    isTerminalLoss: flags.isTerminalLoss ?? false,
  }
}

const sms = (templateBody?: string, extra: Partial<Action> = {}): Action => ({
  type: 'send_sms',
  channel: 'sms',
  ...(templateBody ? { templateBody } : {}),
  ...extra,
})

const email = (subject?: string, extra: Partial<Action> = {}): Action => ({
  type: 'send_email',
  channel: 'email',
  ...(subject ? { subject } : {}),
  ...extra,
})

const task = (title: string, extra: Partial<Action> = {}): Action => ({
  type: 'create_task',
  ...{ title },
  ...extra,
})

const portal = (templateBody?: string, extra: Partial<Action> = {}): Action => ({
  type: 'send_portal_notification',
  channel: 'portal',
  ...(templateBody ? { templateBody } : {}),
  ...extra,
})

const aiMessage = (extra: Partial<Action> = {}): Action => ({
  type: 'generate_ai_message',
  ...extra,
})

const hvac: TemplateData = {
  stages: [
    stage('New Call', 1, COLOR.blue, { triggersAutomation: true }),
    stage('Diagnosed', 2, COLOR.violet),
    stage('Options Presented', 3, COLOR.violet),
    stage('Quote Approved', 4, COLOR.amber),
    stage('Parts Ordered', 5, COLOR.amber),
    stage('Scheduled', 6, COLOR.amber),
    stage('In Progress', 7, COLOR.amber, { triggersAutomation: true }),
    stage('Completed', 8, COLOR.green, { triggersAutomation: true, isTerminalWin: true }),
    stage('Invoice Sent', 9, COLOR.green),
    stage('Payment Received', 10, COLOR.green),
    stage('Review Requested', 11, COLOR.slate),
    stage('Maintenance Plan Offered', 12, COLOR.slate),
    stage('Cancelled', 13, COLOR.red, { isTerminalLoss: true }),
  ],
  automations: [
    {
      name: 'Missed Call Capture',
      triggerEvent: 'missed_call',
      triggerConditions: {},
      actions: [
        sms('We missed your call! Reply or click to book: {{booking_link}}', { delayMinutes: 0 }),
      ],
      templateRef: 'hvac_missed_call',
    },
    {
      name: 'Estimate Follow-up — Day 1',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 1, stage: 'Quote Approved' },
      actions: [sms('Hi {{contact.first_name}}, following up on your estimate. Questions?')],
      templateRef: 'hvac_estimate_followup_d1',
    },
    {
      name: 'Estimate Follow-up — Day 3',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 3, stage: 'Quote Approved' },
      actions: [email('Your estimate is still available')],
      templateRef: 'hvac_estimate_followup_d3',
    },
    {
      name: 'Estimate Follow-up — Day 7',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 7, stage: 'Quote Approved' },
      actions: [task('Call {{contact.first_name}} — estimate follow-up')],
      templateRef: 'hvac_estimate_followup_d7',
    },
    {
      name: 'Job Confirmation',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Scheduled' },
      actions: [
        sms('Confirmed! Your appointment is {{record.scheduled_at}}. Tech: {{assigned_user.name}}'),
      ],
      templateRef: 'hvac_job_confirmation',
    },
    {
      name: 'Post-Job Review Request',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Completed' },
      actions: [
        sms('Your service is complete. How did we do? {{review_link}}', { delayMinutes: 120 }),
      ],
      templateRef: 'hvac_post_job_review',
    },
    {
      name: 'Maintenance Plan Renewal',
      triggerEvent: 'date_relative',
      triggerConditions: { days_before: 30, field: 'maintenance_plan_expiry' },
      actions: [email('Your maintenance plan renews soon')],
      templateRef: 'hvac_maintenance_renewal',
    },
    {
      name: 'Equipment Age Upsell',
      triggerEvent: 'date_relative',
      triggerConditions: { annual: true, field: 'equipment_install_date', min_age_years: 10 },
      actions: [email('Is your system ready for replacement?')],
      templateRef: 'hvac_equipment_upsell',
    },
    {
      name: 'Re-engagement — 12 Months',
      triggerEvent: 'date_relative',
      triggerConditions: { months_since_last_completed: 12 },
      actions: [email('We miss you — time for a tune-up?'), sms('Time for a tune-up? Reply to schedule.')],
      templateRef: 'hvac_re_engagement',
    },
  ],
}

const landscaping: TemplateData = {
  stages: [
    stage('New Lead', 1, COLOR.blue),
    stage('Property Measured', 2, COLOR.violet),
    stage('Estimate Built', 3, COLOR.violet),
    stage('Estimate Sent', 4, COLOR.amber, { triggersAutomation: true }),
    stage('Follow-up', 5, COLOR.amber),
    stage('Contract Signed', 6, COLOR.green, { triggersAutomation: true }),
    stage('First Visit Scheduled', 7, COLOR.amber),
    stage('Recurring Schedule Set', 8, COLOR.slate),
    stage('In Progress', 9, COLOR.amber, { triggersAutomation: true }),
    stage('Season Close + Review', 10, COLOR.green, { isTerminalWin: true }),
    stage('Renewal Offered', 11, COLOR.slate),
    stage('Lost', 12, COLOR.red, { isTerminalLoss: true }),
  ],
  automations: [
    {
      name: 'Estimate Follow-up — Day 2',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 2, stage: 'Estimate Sent' },
      actions: [sms()],
      templateRef: 'land_estimate_followup_d2',
    },
    {
      name: 'Estimate Follow-up — Day 5',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 5, stage: 'Estimate Sent' },
      actions: [email()],
      templateRef: 'land_estimate_followup_d5',
    },
    {
      name: 'Estimate Follow-up — Day 10',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 10, stage: 'Estimate Sent' },
      actions: [task('Call {{contact.first_name}} — estimate follow-up')],
      templateRef: 'land_estimate_followup_d10',
    },
    {
      name: 'Visit Day Alert',
      triggerEvent: 'date_relative',
      triggerConditions: { same_day: true, field: 'scheduled_at' },
      actions: [sms('Your crew is on the way today! ETA: {{eta}}')],
      templateRef: 'land_visit_day_alert',
    },
    {
      name: 'Visit Completed',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Season Close + Review' },
      actions: [sms('Visit complete! Check your portal for photos and summary.')],
      templateRef: 'land_visit_completed',
    },
    {
      name: 'Seasonal Upsell — Spring',
      triggerEvent: 'date_relative',
      triggerConditions: { seasonal_window: 'spring' },
      actions: [email('Spring cleanup time — book now')],
      templateRef: 'land_seasonal_upsell_spring',
    },
    {
      name: 'Contract Renewal — 30 Days',
      triggerEvent: 'date_relative',
      triggerConditions: { days_before: 30, field: 'contract_end_date' },
      actions: [email('Your service contract renews soon')],
      templateRef: 'land_contract_renewal',
    },
    {
      name: 'Season End Referral',
      triggerEvent: 'date_relative',
      triggerConditions: { seasonal_window: 'fall_close' },
      actions: [email('Thank you for a great season')],
      templateRef: 'land_season_end_referral',
    },
  ],
}

const plumbing: TemplateData = {
  stages: [
    stage('Emergency Call', 1, COLOR.red, { triggersAutomation: true }),
    stage('Assessed On-Site', 2, COLOR.amber),
    stage('Options Presented', 3, COLOR.violet),
    stage('Approved', 4, COLOR.green, { triggersAutomation: true }),
    stage('Parts Confirmed', 5, COLOR.amber),
    stage('In Progress', 6, COLOR.amber),
    stage('Completed', 7, COLOR.green, { triggersAutomation: true, isTerminalWin: true }),
    stage('Invoice Sent', 8, COLOR.green),
    stage('Payment Collected', 9, COLOR.green),
    stage('Maintenance Plan Offered', 10, COLOR.slate),
    stage('Review Requested', 11, COLOR.slate),
    stage('Declined', 12, COLOR.red, { isTerminalLoss: true }),
  ],
  automations: [
    {
      name: 'Missed Call — 90s',
      triggerEvent: 'missed_call',
      triggerConditions: {},
      actions: [
        sms("We missed your call. We're on it — a plumber will call you back shortly.", {
          delayMinutes: 0,
        }),
      ],
      templateRef: 'plumb_missed_call',
    },
    {
      name: 'Job Completed — Invoice',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Completed' },
      actions: [sms('Job complete! Your invoice is ready: {{payment_link}}', { delayMinutes: 60 })],
      templateRef: 'plumb_job_complete',
    },
    {
      name: 'Quote Follow-up — Day 1',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 1, stage: 'Options Presented' },
      actions: [sms()],
      templateRef: 'plumb_quote_followup_d1',
    },
    {
      name: 'Quote Follow-up — Day 3',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 3, stage: 'Options Presented' },
      actions: [email()],
      templateRef: 'plumb_quote_followup_d3',
    },
    {
      name: 'Water Heater Age',
      triggerEvent: 'date_relative',
      triggerConditions: { annual: true, field: 'install_date', min_age_years: 8 },
      actions: [email('Your water heater may need attention')],
      templateRef: 'plumb_water_heater_age',
    },
    {
      name: 'Re-engagement — 18 Months',
      triggerEvent: 'date_relative',
      triggerConditions: { months_since_last_completed: 18 },
      actions: [email('Time for a seasonal plumbing check?'), sms('Time for a seasonal plumbing check?')],
      templateRef: 'plumb_re_engagement',
    },
  ],
}

const construction: TemplateData = {
  stages: [
    stage('Inquiry', 1, COLOR.blue),
    stage('Site Visit', 2, COLOR.violet),
    stage('Estimate Built', 3, COLOR.violet),
    stage('Proposal Sent', 4, COLOR.amber, { triggersAutomation: true }),
    stage('Contract Signed', 5, COLOR.green, { triggersAutomation: true }),
    stage('Permits', 6, COLOR.amber),
    stage('Demo', 7, COLOR.amber),
    stage('Rough Work', 8, COLOR.amber),
    stage('Inspections', 9, COLOR.violet),
    stage('Finish Work', 10, COLOR.amber),
    stage('Punch List', 11, COLOR.violet, { triggersAutomation: true }),
    stage('Final Walkthrough', 12, COLOR.violet),
    stage('Closed + Review', 13, COLOR.green, { isTerminalWin: true }),
    stage('Warranty Period', 14, COLOR.slate),
    stage('Lost', 15, COLOR.red, { isTerminalLoss: true }),
  ],
  automations: [
    {
      name: 'Contract Signed — Welcome',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Contract Signed' },
      actions: [
        email('Your project is officially underway'),
        portal('Your project is officially underway'),
      ],
      templateRef: 'const_contract_welcome',
    },
    {
      name: 'Phase Update',
      triggerEvent: 'stage_changed',
      triggerConditions: {},
      actions: [portal('Project update: {{new_stage}}')],
      templateRef: 'const_phase_update',
    },
    {
      name: 'Change Order Approval',
      triggerEvent: 'record_value_threshold',
      triggerConditions: { percent: 110 },
      actions: [
        email('Change order requires your approval'),
        portal('Change order requires your approval'),
      ],
      templateRef: 'const_change_order',
    },
    {
      name: 'Milestone Payment',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Rough Work' },
      actions: [email('Milestone payment due')],
      templateRef: 'const_milestone_payment',
    },
    {
      name: 'Punch List Prompt',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Punch List' },
      actions: [email('Final walkthrough — schedule yours')],
      templateRef: 'const_punch_list',
    },
    {
      name: 'Project Complete — Review',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Closed + Review' },
      actions: [
        email('Project complete — share your experience'),
        sms('Project complete — share your experience'),
      ],
      templateRef: 'const_complete_review',
    },
    {
      name: 'Warranty Check-In — 60 Days',
      triggerEvent: 'date_relative',
      triggerConditions: { days_after: 60, stage: 'Closed + Review' },
      actions: [email('60-day warranty check-in')],
      templateRef: 'const_warranty_checkin',
    },
  ],
}

const propertyMgmtLease: TemplateData = {
  stages: [
    stage('Vacancy Created', 1, COLOR.slate, { triggersAutomation: true }),
    stage('Listed', 2, COLOR.blue),
    stage('Showing Scheduled', 3, COLOR.amber),
    stage('Application Submitted', 4, COLOR.violet),
    stage('Screened + Approved', 5, COLOR.green),
    stage('Lease Signed', 6, COLOR.green, { triggersAutomation: true }),
    stage('Move-In Inspection', 7, COLOR.amber),
    stage('Active Tenancy', 8, COLOR.green, { triggersAutomation: true }),
    stage('90-Day Renewal Sequence', 9, COLOR.violet, { triggersAutomation: true }),
    stage('Renewal Signed', 10, COLOR.green, { isTerminalWin: true }),
    // Vacancy Opened marks the end of a tenancy and satisfies the
    // "every template must have an isTerminalLoss stage" invariant.
    stage('Vacancy Opened', 11, COLOR.red, { triggersAutomation: true, isTerminalLoss: true }),
    stage('Move-Out Inspection', 12, COLOR.amber),
    stage('Deposit Settlement', 13, COLOR.slate),
  ],
  automations: [],
}

const propertyMgmtMaintenance: TemplateData = {
  stages: [
    stage('Submitted', 1, COLOR.blue, { triggersAutomation: true }),
    stage('Vendor Assigned', 2, COLOR.violet, { triggersAutomation: true }),
    stage('Scheduled', 3, COLOR.amber),
    stage('In Progress', 4, COLOR.amber),
    stage('Completed', 5, COLOR.green, { triggersAutomation: true, isTerminalWin: true }),
    stage('Tenant Confirmed', 6, COLOR.green),
    stage('Work Order Closed', 7, COLOR.slate, { isTerminalWin: true }),
    // Cancelled is added to satisfy the "every template must have an
    // isTerminalLoss stage" invariant — real maintenance requests do get
    // cancelled (tenant withdraws, duplicate ticket, vendor unavailable).
    stage('Cancelled', 8, COLOR.red, { isTerminalLoss: true }),
  ],
  automations: [],
}

// property_mgmt covers BOTH record types — automations are duplicated across
// the lease and maintenance templates so each record-type pipeline carries
// its own copy of the rules that apply to it. templateRef uniqueness is
// enforced across the *set of all rows* — to avoid collisions we suffix the
// maintenance copy with `_m`.
const propertyMgmtAutomations = (suffix: string): Automation[] => [
  {
    name: 'Maintenance Acknowledgement',
    triggerEvent: 'record_created',
    triggerConditions: { recordType: 'maintenance' },
    actions: [
      sms("We received your maintenance request #{{record.id}}. We'll update you shortly."),
    ],
    templateRef: `pm_maintenance_ack${suffix}`,
  },
  {
    name: 'Vendor Assigned',
    triggerEvent: 'stage_changed',
    triggerConditions: { toStage: 'Vendor Assigned' },
    actions: [
      sms(
        'Your request has been assigned. Vendor: {{vendor_name}} will contact you to schedule.',
      ),
    ],
    templateRef: `pm_vendor_assigned${suffix}`,
  },
  {
    name: 'Maintenance Resolved',
    triggerEvent: 'stage_changed',
    triggerConditions: { toStage: 'Completed' },
    actions: [sms('Your maintenance issue is resolved.'), email('Your maintenance issue is resolved')],
    templateRef: `pm_maintenance_resolved${suffix}`,
  },
  {
    name: 'Rent Reminder',
    triggerEvent: 'date_relative',
    triggerConditions: { days_before: 5, field: 'due_at', recordType: 'invoice' },
    actions: [sms('Rent reminder: {{amount}} due {{due_date}}. Pay here: {{payment_link}}')],
    templateRef: `pm_rent_reminder${suffix}`,
  },
  {
    name: 'Rent Overdue — Day 1',
    triggerEvent: 'invoice_overdue',
    triggerConditions: { days_overdue: 1 },
    actions: [sms()],
    templateRef: `pm_rent_overdue_d1${suffix}`,
  },
  {
    name: 'Rent Overdue — Day 3',
    triggerEvent: 'invoice_overdue',
    triggerConditions: { days_overdue: 3 },
    actions: [email('Important: Rent payment overdue')],
    templateRef: `pm_rent_overdue_d3${suffix}`,
  },
  {
    name: 'Rent Overdue — Day 7',
    triggerEvent: 'invoice_overdue',
    triggerConditions: { days_overdue: 7 },
    actions: [task('Escalate overdue rent — {{contact.name}}')],
    templateRef: `pm_rent_overdue_d7${suffix}`,
  },
  {
    name: 'Lease Renewal — 90 Days',
    triggerEvent: 'date_relative',
    triggerConditions: { days_before: 90, field: 'lease_end_date' },
    actions: [email('Your lease renewal options are ready')],
    templateRef: `pm_renewal_90d${suffix}`,
  },
  {
    name: 'Lease Renewal — 60 Days',
    triggerEvent: 'date_relative',
    triggerConditions: { days_before: 60, field: 'lease_end_date' },
    actions: [email('Lease renewal — 60 days remaining')],
    templateRef: `pm_renewal_60d${suffix}`,
  },
  {
    name: 'Lease Renewal — 30 Days',
    triggerEvent: 'date_relative',
    triggerConditions: { days_before: 30, field: 'lease_end_date' },
    actions: [email('Final notice: Lease renewal or vacate')],
    templateRef: `pm_renewal_30d${suffix}`,
  },
  {
    name: 'After-Hours Auto-Reply',
    triggerEvent: 'missed_call',
    triggerConditions: { outside_business_hours: true },
    actions: [
      sms(
        "Our office is closed. For emergencies: {{emergency_line}}. We'll call back next business day.",
      ),
    ],
    templateRef: `pm_after_hours${suffix}`,
  },
]

propertyMgmtLease.automations = propertyMgmtAutomations('')
propertyMgmtMaintenance.automations = propertyMgmtAutomations('_m')

const agency: TemplateData = {
  stages: [
    stage('New Lead', 1, COLOR.blue),
    stage('Discovery Call', 2, COLOR.violet),
    stage('Proposal Sent', 3, COLOR.amber, { triggersAutomation: true }),
    stage('Contract Signed', 4, COLOR.green, { triggersAutomation: true }),
    stage('Onboarding', 5, COLOR.amber),
    stage('Active', 6, COLOR.green, { triggersAutomation: true }),
    stage('Monthly Report Cycle', 7, COLOR.slate),
    stage('Quarterly Review', 8, COLOR.slate),
    stage('Renewal / Upsell', 9, COLOR.violet, { triggersAutomation: true }),
    stage('Churned', 10, COLOR.red, { isTerminalLoss: true }),
    stage('Closed - Won', 11, COLOR.green, { isTerminalWin: true }),
  ],
  automations: [
    {
      name: 'Contract Signed — Onboarding',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Contract Signed' },
      actions: [email('Welcome — your portal is ready'), portal('Welcome — your portal is ready')],
      templateRef: 'agency_contract_welcome',
    },
    {
      name: 'Deliverable Approval Nudge',
      triggerEvent: 'date_relative',
      triggerConditions: { hours_after: 48, stage: 'Active', field: 'last_approval_request' },
      actions: [
        sms('Action needed: approval waiting in your portal'),
        email('Action needed: approval waiting in your portal'),
      ],
      templateRef: 'agency_approval_nudge',
    },
    {
      name: 'Portal Inactivity — 14 Days',
      triggerEvent: 'portal_inactive',
      triggerConditions: { days: 14 },
      actions: [email('We have updates waiting for you')],
      templateRef: 'agency_portal_inactive',
    },
    {
      name: 'Monthly Report',
      triggerEvent: 'date_relative',
      triggerConditions: { day_of_month: 1 },
      actions: [
        aiMessage(),
        email('Your {{month}} performance report is ready'),
        portal('Your {{month}} performance report is ready'),
      ],
      templateRef: 'agency_monthly_report',
    },
    {
      name: 'Scope Alert — 85%',
      triggerEvent: 'record_value_threshold',
      triggerConditions: { percent_of_contracted: 85 },
      actions: [email('Heads up: approaching monthly scope')],
      templateRef: 'agency_scope_85',
    },
    {
      name: 'Scope Exceeded',
      triggerEvent: 'record_value_threshold',
      triggerConditions: { percent_of_contracted: 100 },
      actions: [email('Monthly scope complete — overage rates apply')],
      templateRef: 'agency_scope_100',
    },
    {
      name: 'Contract Renewal — 45 Days',
      triggerEvent: 'date_relative',
      triggerConditions: { days_before: 45, field: 'contract_end_date' },
      actions: [task('Start renewal conversation — {{contact.name}}')],
      templateRef: 'agency_renewal_45d',
    },
    {
      name: 'Low NPS — Escalation',
      triggerEvent: 'signal_generated',
      triggerConditions: { signalType: 'low_nps' },
      actions: [task('Address low NPS — {{contact.name}}'), email('Low NPS — internal alert')],
      templateRef: 'agency_low_nps',
    },
  ],
}

const realEstate: TemplateData = {
  stages: [
    stage('Lead Captured', 1, COLOR.blue, { triggersAutomation: true }),
    stage('Contacted + Qualified', 2, COLOR.violet),
    stage('Active Buyer / Listing Agreement', 3, COLOR.green),
    stage('Showings / Property Prep', 4, COLOR.amber),
    stage('Offer Submitted', 5, COLOR.violet, { triggersAutomation: true }),
    stage('Under Contract', 6, COLOR.green, { triggersAutomation: true }),
    stage('Inspection', 7, COLOR.amber),
    stage('Appraisal', 8, COLOR.amber),
    stage('Clear to Close', 9, COLOR.green, { triggersAutomation: true }),
    stage('Closing Day', 10, COLOR.green, { triggersAutomation: true, isTerminalWin: true }),
    stage('Post-Close Follow-Up', 11, COLOR.slate),
    stage('Anniversary Re-Engagement', 12, COLOR.slate),
    stage('Lost', 13, COLOR.red, { isTerminalLoss: true }),
  ],
  automations: [
    {
      name: 'New Lead — 60s Response',
      triggerEvent: 'record_created',
      triggerConditions: {},
      actions: [
        sms("Thanks for reaching out! I'll be in touch shortly. — {{assigned_user.name}}", {
          delayMinutes: 0,
        }),
        email("Thanks for reaching out! I'll be in touch shortly. — {{assigned_user.name}}", {
          delayMinutes: 0,
        }),
      ],
      templateRef: 're_new_lead_60s',
    },
    {
      name: 'Lead — No Contact 24h',
      triggerEvent: 'date_relative',
      triggerConditions: { hours_after: 24, stage: 'Lead Captured' },
      actions: [task('URGENT: Contact {{contact.name}} — 24h no response')],
      templateRef: 're_lead_no_contact',
    },
    {
      name: 'Showing Confirmation',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Showings / Property Prep' },
      actions: [sms('Showing confirmed'), email('Showing confirmed')],
      templateRef: 're_showing_confirmation',
    },
    {
      name: 'Offer Submitted Update',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Offer Submitted' },
      actions: [
        portal("Your offer has been submitted. We'll update you as soon as we hear back."),
        sms("Your offer has been submitted. We'll update you as soon as we hear back."),
      ],
      templateRef: 're_offer_submitted',
    },
    {
      name: 'Under Contract — Checklist',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Under Contract' },
      actions: [
        email("Under contract — here's what happens next"),
        portal("Under contract — here's what happens next"),
      ],
      templateRef: 're_under_contract',
    },
    {
      name: 'Clear to Close',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Clear to Close' },
      actions: [
        sms('Clear to close! Closing details in your portal.'),
        portal('Clear to close! Closing details in your portal.'),
      ],
      templateRef: 're_clear_to_close',
    },
    {
      name: 'Closing Complete',
      triggerEvent: 'stage_changed',
      triggerConditions: { toStage: 'Closing Day' },
      actions: [
        email("Congratulations — you're closed!"),
        sms("Congratulations — you're closed!"),
      ],
      templateRef: 're_closing_complete',
    },
    {
      name: 'Anniversary — 12 Months',
      triggerEvent: 'date_relative',
      triggerConditions: { months_after: 12, field: 'completed_at' },
      actions: [email('Happy 1-year anniversary in your home!')],
      templateRef: 're_anniversary_12mo',
    },
  ],
}

const TEMPLATES: TemplateRow[] = [
  { vertical: 'hvac', recordType: 'job', templateData: hvac },
  { vertical: 'landscaping', recordType: 'job', templateData: landscaping },
  { vertical: 'plumbing', recordType: 'job', templateData: plumbing },
  { vertical: 'construction', recordType: 'project', templateData: construction },
  { vertical: 'property_mgmt', recordType: 'lease', templateData: propertyMgmtLease },
  { vertical: 'property_mgmt', recordType: 'maintenance', templateData: propertyMgmtMaintenance },
  { vertical: 'agency', recordType: 'campaign', templateData: agency },
  { vertical: 'real_estate', recordType: 'transaction', templateData: realEstate },
]

function assertTemplateInvariants(templates: TemplateRow[]): void {
  const seenRefs = new Set<string>()

  for (const t of templates) {
    const id = `${t.vertical}/${t.recordType}`
    const stages = t.templateData.stages
    const automations = t.templateData.automations

    const hasWin = stages.some((s) => s.isTerminalWin)
    const hasLoss = stages.some((s) => s.isTerminalLoss)

    if (!hasWin) {
      throw new Error(`Template ${id} is missing an isTerminalWin stage.`)
    }
    if (!hasLoss) {
      throw new Error(`Template ${id} is missing an isTerminalLoss stage.`)
    }

    for (const a of automations) {
      if (seenRefs.has(a.templateRef)) {
        throw new Error(`Duplicate templateRef "${a.templateRef}" detected in ${id}.`)
      }
      seenRefs.add(a.templateRef)
    }
  }
}

export async function seedVerticalTemplates(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed vertical templates.')
  }

  assertTemplateInvariants(TEMPLATES)

  const client = postgres(databaseUrl, { prepare: false })
  const db = drizzle(client)

  try {
    const existing = await db.select().from(verticalTemplates).limit(1)
    if (existing.length > 0) {
      console.log('Vertical templates already seeded. Skipping.')
      return
    }

    await db.insert(verticalTemplates).values(TEMPLATES)

    console.log(`✓ Seeded ${TEMPLATES.length} vertical templates`)
    TEMPLATES.forEach((t) => {
      console.log(
        `  ${t.vertical} (${t.recordType}): ${t.templateData.stages.length} stages, ${t.templateData.automations.length} automations`,
      )
    })
  } finally {
    await client.end()
  }
}

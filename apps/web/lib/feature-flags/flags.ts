export const FLAG_DEFAULTS = {
  native_crm: { team: true, enterprise: true },
  native_email_engine: { team: true, enterprise: true },
  native_pipeline: { team: true, enterprise: true },
  native_invoicing: { team: true, enterprise: true },
  ai_message_drafting: { team: true, enterprise: true },
  intelligence_feed: { team: true, enterprise: true },
  client_portal: { team: true, enterprise: true },
  automation_engine: { team: true, enterprise: true },
  sequence_builder: { team: true, enterprise: true },
  lead_scoring: { team: true, enterprise: true },

  lead_pipeline: { team: true, enterprise: true },
  aspire: { team: true, enterprise: true },
  linkedin_automation: { team: true, enterprise: true },

  autonomous_ai_messaging: { team: false, enterprise: true },
  executive_dashboard: { team: false, enterprise: true },
  retention_health_scoring: { team: false, enterprise: true },
  advanced_forecasting: { team: false, enterprise: true },
  ai_report_narrative: { team: false, enterprise: true },
  proposal_generation: { team: false, enterprise: true },
  win_loss_analysis: { team: false, enterprise: true },
  custom_integration_stack: { team: false, enterprise: true },
  scenario_modeling: { team: false, enterprise: true },
  relationship_health: { team: false, enterprise: true },

  multi_location: { team: false, enterprise: false },
  bilingual_portal: { team: false, enterprise: false },
  advanced_reporting: { team: false, enterprise: false },
} as const

export type FlagName = keyof typeof FLAG_DEFAULTS
export type Plan = 'team' | 'enterprise'

export function getPlanDefault(flagName: FlagName, plan: Plan): boolean {
  return FLAG_DEFAULTS[flagName][plan]
}

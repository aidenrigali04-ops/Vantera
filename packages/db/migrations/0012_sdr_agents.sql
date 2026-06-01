-- Phase 5/6 — SDR Agents module
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'sdr_agent';

CREATE TABLE IF NOT EXISTS sdr_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  agent_title text NOT NULL DEFAULT 'Sales Development Rep',
  from_email text NOT NULL,
  from_name text NOT NULL,
  signature text,
  icp_config jsonb NOT NULL DEFAULT '{}',
  target_verticals text[] NOT NULL DEFAULT '{}',
  target_cities text[] NOT NULL DEFAULT '{}',
  exclude_domains text[] NOT NULL DEFAULT '{}',
  search_frequency text NOT NULL DEFAULT 'daily',
  outreach_days text[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  outreach_window jsonb NOT NULL DEFAULT '{"startHour":8,"endHour":17,"tz":"America/New_York"}',
  max_new_leads_day integer NOT NULL DEFAULT 10,
  max_active_leads integer NOT NULL DEFAULT 200,
  is_active boolean NOT NULL DEFAULT false,
  is_paused boolean NOT NULL DEFAULT false,
  paused_reason text,
  last_run_at timestamptz,
  total_leads_found integer NOT NULL DEFAULT 0,
  total_contacted integer NOT NULL DEFAULT 0,
  total_replied integer NOT NULL DEFAULT 0,
  total_booked integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sdr_agent_configs_active_idx ON sdr_agent_configs (is_active, is_paused);

CREATE TABLE IF NOT EXISTS sdr_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES sdr_agent_configs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  aspire_result_id uuid REFERENCES aspire_results(id),
  status text NOT NULL DEFAULT 'active',
  current_step integer NOT NULL DEFAULT 0,
  total_steps integer NOT NULL DEFAULT 5,
  next_step_at timestamptz,
  last_step_at timestamptz,
  replied_at timestamptz,
  reply_type text,
  booked_at timestamptz,
  meeting_url text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sdr_sequences_account_status_idx ON sdr_sequences (account_id, status);
CREATE INDEX IF NOT EXISTS sdr_sequences_lead_idx ON sdr_sequences (lead_id, account_id);

CREATE TABLE IF NOT EXISTS sdr_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES sdr_sequences(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  resend_id text,
  twilio_sid text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sdr_sequence_steps_due_idx ON sdr_sequence_steps (account_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS sdr_sequence_steps_resend_idx ON sdr_sequence_steps (resend_id);
CREATE INDEX IF NOT EXISTS sdr_sequence_steps_twilio_idx ON sdr_sequence_steps (twilio_sid);

CREATE TABLE IF NOT EXISTS sdr_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES sdr_agent_configs(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id),
  sequence_id uuid REFERENCES sdr_sequences(id),
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sdr_activity_log_account_idx ON sdr_activity_log (account_id, created_at DESC);

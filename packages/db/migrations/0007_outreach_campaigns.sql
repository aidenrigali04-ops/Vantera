-- Unified outreach campaigns (Phase 1 — email sequences on leads)

DO $$ BEGIN
  CREATE TYPE outreach_campaign_goal AS ENUM ('book_meeting', 'fill_funnel', 're_engage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE outreach_campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE outreach_enrollment_status AS ENUM ('active', 'paused', 'completed', 'replied', 'unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  goal outreach_campaign_goal NOT NULL DEFAULT 'book_meeting',
  status outreach_campaign_status NOT NULL DEFAULT 'draft',
  channels jsonb NOT NULL DEFAULT '["email"]'::jsonb,
  workflow jsonb NOT NULL DEFAULT '{"steps":[]}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{"enrolled":0,"sent":0,"failed":0,"replied":0,"meetings":0}'::jsonb,
  owner_id uuid REFERENCES users(id),
  launched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS outreach_campaigns_account_id_idx ON outreach_campaigns(account_id);
CREATE INDEX IF NOT EXISTS outreach_campaigns_status_idx ON outreach_campaigns(status, account_id);

CREATE TABLE IF NOT EXISTS outreach_campaign_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status outreach_enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  paused_at timestamptz,
  completed_at timestamptz,
  replied_at timestamptz,
  meeting_booked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_enrollments_account_id_idx ON outreach_campaign_enrollments(account_id);
CREATE INDEX IF NOT EXISTS outreach_enrollments_campaign_id_idx ON outreach_campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS outreach_enrollments_lead_id_idx ON outreach_campaign_enrollments(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_enrollments_campaign_lead_idx
  ON outreach_campaign_enrollments(campaign_id, lead_id);

CREATE TABLE IF NOT EXISTS outreach_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES outreach_campaign_enrollments(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  step_index smallint NOT NULL,
  channel channel NOT NULL DEFAULT 'email',
  subject varchar(500),
  body text NOT NULL,
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  status sequence_step_status NOT NULL DEFAULT 'pending',
  skip_reason text,
  provider_message_id varchar(255),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_campaign_steps_account_id_idx ON outreach_campaign_steps(account_id);
CREATE INDEX IF NOT EXISTS outreach_campaign_steps_campaign_id_idx ON outreach_campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS outreach_campaign_steps_enrollment_id_idx ON outreach_campaign_steps(enrollment_id);
CREATE INDEX IF NOT EXISTS outreach_campaign_steps_status_idx ON outreach_campaign_steps(status, send_at);

ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS outreach_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  agent_name text NOT NULL DEFAULT 'Outreach Agent',
  linked_campaign_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  is_paused boolean NOT NULL DEFAULT false,
  paused_reason text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_agent_configs_active_idx
  ON outreach_agent_configs (is_active, is_paused);

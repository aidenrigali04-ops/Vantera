-- Pull leads → AI sequence draft → outreach: review vs automatic

ALTER TABLE sdr_agent_configs
  ADD COLUMN IF NOT EXISTS outreach_automation_mode varchar(20) NOT NULL DEFAULT 'review';

ALTER TABLE sdr_agent_configs
  DROP CONSTRAINT IF EXISTS sdr_agent_configs_outreach_automation_mode_check;

ALTER TABLE sdr_agent_configs
  ADD CONSTRAINT sdr_agent_configs_outreach_automation_mode_check
  CHECK (outreach_automation_mode IN ('review', 'automatic'));

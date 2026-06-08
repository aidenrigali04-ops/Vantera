-- Reset agent setup for all workspaces so users can configure agents via the new workspace UI.
-- Soft-delete preserves history; partial unique indexes allow one active config per account.

ALTER TABLE sdr_agent_configs
  DROP CONSTRAINT IF EXISTS sdr_agent_configs_account_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS sdr_agent_configs_account_id_active_uidx
  ON sdr_agent_configs (account_id)
  WHERE deleted_at IS NULL;

ALTER TABLE outreach_agent_configs
  DROP CONSTRAINT IF EXISTS outreach_agent_configs_account_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS outreach_agent_configs_account_id_active_uidx
  ON outreach_agent_configs (account_id)
  WHERE deleted_at IS NULL;

WITH reset_scout_configs AS (
  UPDATE sdr_agent_configs
  SET
    deleted_at = now(),
    is_active = false,
    is_paused = true,
    paused_reason = COALESCE(paused_reason, 'Reset for agent workspace refresh'),
    updated_at = now()
  WHERE deleted_at IS NULL
  RETURNING id
)
UPDATE sdr_aspire_bindings b
SET
  is_active = false,
  updated_at = now()
FROM reset_scout_configs r
WHERE b.config_id = r.id
  AND b.is_active = true;

UPDATE outreach_agent_configs
SET
  deleted_at = now(),
  is_active = false,
  is_paused = true,
  paused_reason = COALESCE(paused_reason, 'Reset for agent workspace refresh'),
  updated_at = now()
WHERE deleted_at IS NULL;

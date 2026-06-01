-- Phase 2: Resend webhook correlation for outbound messages

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS messages_resend_id_idx
  ON messages ((metadata->>'resendId'));

-- Portal invite tracking for admin resend cooldown and audit
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS portal_invited_at timestamptz;

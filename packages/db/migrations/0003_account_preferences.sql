-- Vantera migration 0003 — account personalization preferences
--
-- Adds the optional preference columns consumed by the template
-- personalization engine in @vantera/db/personalize.ts:
--
--   booking_link, review_link, payment_link  — overrides for {{*_link}} placeholders
--   business_hours_start, business_hours_end — drive outside_business_hours triggers
--   emergency_line                            — substitutes {{emergency_line}}
--   voice_preference                          — selects AI voice rewrite tone
--   active_template_id                        — last template the user applied; used
--                                               to re-personalize after an integration
--                                               connects (e.g. Twilio in Step 6).
--
-- All columns are nullable on purpose so existing accounts keep working. The
-- personalization engine falls back to portal-URL defaults when a value is null.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS booking_link text,
  ADD COLUMN IF NOT EXISTS review_link text,
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS emergency_line varchar(50),
  ADD COLUMN IF NOT EXISTS business_hours_start smallint,
  ADD COLUMN IF NOT EXISTS business_hours_end smallint,
  ADD COLUMN IF NOT EXISTS voice_preference varchar(20),
  ADD COLUMN IF NOT EXISTS active_template_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_active_template_id_fkey'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_active_template_id_fkey
      FOREIGN KEY (active_template_id) REFERENCES vertical_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_business_hours_range_chk'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_business_hours_range_chk
      CHECK (
        (business_hours_start IS NULL OR (business_hours_start >= 0 AND business_hours_start <= 23))
        AND
        (business_hours_end IS NULL OR (business_hours_end >= 0 AND business_hours_end <= 23))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_voice_preference_chk'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_voice_preference_chk
      CHECK (
        voice_preference IS NULL
        OR voice_preference IN ('friendly', 'professional', 'urgent')
      );
  END IF;
END $$;

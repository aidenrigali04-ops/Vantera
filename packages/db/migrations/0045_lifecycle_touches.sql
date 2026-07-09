-- 0045: lifecycle_touches — operator-side lifecycle re-engagement ledger.
-- Founder LinkedIn DMs to our OWN users at three cliffs: stalled onboarding,
-- idle after onboarding, trial lapsed. Spec: docs/superpowers/specs/2026-07-09-*.
--
-- Platform-operator data, NOT tenant data: no account-scoped policies, no client
-- grants — service role only (same class as webhook_events / copilot_knowledge_chunks).
-- RLS is ENABLED with no policies so anon/authenticated see nothing (rule 02).
--
-- Retention / deletion (rule 11): rows describe our own users, not prospects. GDPR
-- deletion rides the user_id FK cascade when the auth user is deleted; account_id is
-- SET NULL so touch history survives account-row deletion but never dangles.
--
-- Runtime config rides app_settings keys (service-role written):
--   lifecycle_outreach_enabled, lifecycle_sender_ref, lifecycle_daily_cap,
--   lifecycle_sender_location, lifecycle_notify_email, lifecycle_last_run_at.

CREATE TABLE public.lifecycle_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  segment text NOT NULL CONSTRAINT lifecycle_touches_segment_check
    CHECK (segment IN ('stalled_onboarding', 'idle_after_onboarding', 'trial_lapsed')),
  touch_number int NOT NULL CONSTRAINT lifecycle_touches_touch_check
    CHECK (touch_number IN (1, 2)),
  status text NOT NULL DEFAULT 'pending' CONSTRAINT lifecycle_touches_status_check
    CHECK (status IN ('pending', 'invited', 'sent', 'failed', 'skipped_no_linkedin', 'canceled')),
  attempts int NOT NULL DEFAULT 0,
  linkedin_url text,
  target_provider_ref text,
  display_name text,
  stalled_step text,
  message_body text,
  message_ref text,
  error text,
  invite_sent_at timestamptz,
  connected_at timestamptz,
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lifecycle_touches_user_segment_touch_idx
  ON public.lifecycle_touches (user_id, segment, touch_number);
CREATE INDEX lifecycle_touches_status_idx ON public.lifecycle_touches (status);
CREATE INDEX lifecycle_touches_target_ref_idx ON public.lifecycle_touches (target_provider_ref);

ALTER TABLE public.lifecycle_touches ENABLE ROW LEVEL SECURITY;
-- no policies: service-role only by construction

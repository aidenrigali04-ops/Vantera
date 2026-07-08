-- 0044: conversation-engine upgrade (2026-07-08 copy/conversion analysis)
--
-- 1. scheduled_sends.origin — which machine queued the send. Drives the dispatch
--    priority lane: 'reply_response' rows (the responder answering a live prospect)
--    skip the human-pacing queue (speed-to-lead: <5 min response ≈ 21x qualification
--    vs 30 min), while 'sequence' rows keep full pacing + business-hours windows.
--    'manual' = a human typed it in the reply box.
-- 2. sequence_runs.revived_at — the one-shot soft-no revival: an exhausted run whose
--    lead HAD replied gets one respectful re-touch ~30 days later, never more (null =
--    revival still available).
-- 3. lead_notifications.kind gains 'needs_human' — the agent hit its conversation
--    turn cap (or otherwise stepped aside) and a human should take the thread over.
--
-- No new tables → no new RLS. All three columns are server-written only (service
-- role); no client column grants (0025 lockdown pattern respected).

ALTER TABLE scheduled_sends
  ADD COLUMN origin text NOT NULL DEFAULT 'sequence'
  CONSTRAINT scheduled_sends_origin_check CHECK (origin IN ('sequence', 'reply_response', 'manual'));

ALTER TABLE sequence_runs
  ADD COLUMN revived_at timestamptz;

ALTER TABLE lead_notifications DROP CONSTRAINT lead_notifications_kind_check;
ALTER TABLE lead_notifications
  ADD CONSTRAINT lead_notifications_kind_check
  CHECK (kind = ANY (ARRAY['reply'::text, 'converted'::text, 'exhausted'::text, 'hot_signal'::text, 'needs_human'::text]));

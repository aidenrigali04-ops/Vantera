-- Migration #9 (file 0008): review-queue support.
-- scheduled_sends.style_flags: unresolved humanizer violations shown as badges in the
-- review queue (rule 08 — flags surface, never silently shipped). Previously rode the
-- error column as 'style: …'; backfilled below. No new tables — existing RLS covers it.

alter table public.scheduled_sends add column style_flags text;

update public.scheduled_sends
  set style_flags = substring(error from 8), error = null
  where error like 'style: %';

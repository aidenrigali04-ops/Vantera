-- 0050: the meeting layer (last-mile spec 2026-07-15, L1).
-- Booking becomes a first-class event instead of an inference-only analytics stamp:
--   meeting_at     — when the meeting is scheduled for (null = unknown/not stated)
--   meeting_source — which writer recorded it: 'agent' (reply-classification detector)
--                    or 'manual' (the user's Mark-meeting-booked control; authoritative)
alter table leads add column if not exists meeting_at timestamptz;
alter table leads add column if not exists meeting_source text
  check (meeting_source in ('agent','manual'));

comment on column leads.meeting_at is
  'Scheduled meeting time when known (L1 meeting layer). Null = booked but time not captured.';
comment on column leads.meeting_source is
  'Writer of the booking: agent (reply-classification detector) or manual (user control, authoritative).';

-- Column-lockdown pattern (0038→0039 gotcha): the manual Mark-meeting-booked server action
-- runs through the RLS user client, so these columns need an explicit UPDATE grant.
grant update (meeting_booked_at, meeting_at, meeting_source) on leads to authenticated;

-- New notification kind for the booking event. The kind check constraint must be recreated.
alter table lead_notifications drop constraint if exists lead_notifications_kind_check;
alter table lead_notifications add constraint lead_notifications_kind_check
  check (kind in ('reply','converted','exhausted','hot_signal','needs_human','meeting_booked'));

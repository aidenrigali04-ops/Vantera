-- Migration #32: 'hot_signal' lead notification kind. The anticipation-loop hook (Surface A): when
-- the Scout qualifies a lead carrying a fresh, high-value buying signal (funding, intent, exec hire,
-- M&A — the "strike now" events from lead_signals, 0031), it drops a notification so the user has an
-- unpredictable, high-value reason to come back and work it. Extends the existing reply/converted/
-- exhausted set on lead_notifications (0017); the dock bell + notification query are kind-agnostic.

alter table public.lead_notifications drop constraint if exists lead_notifications_kind_check;
alter table public.lead_notifications
  add constraint lead_notifications_kind_check
  check (kind in ('reply', 'converted', 'exhausted', 'hot_signal'));

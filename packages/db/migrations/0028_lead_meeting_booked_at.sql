-- 0028: meeting-booked stage on leads (WS-A — attribution funnel, Phase 8).
-- A booked meeting is a mid-funnel outcome the ROI funnel counts between 'replied' and the
-- close stage (status='converted' / closed_at, added in 0016). Distinct from both: a lead can
-- book a meeting that hasn't closed yet. Nullable.
--
-- Server-only: set by the attribution flow (a booking signal / classified outcome), never by
-- the client — so the funnel can't be forged. This relies on the 0025 lockdown: table-level
-- UPDATE on public.leads is revoked and only an explicit column list is granted to
-- `authenticated`. A new column is therefore NOT client-updatable unless added to that grant
-- (0025's note: "New leads columns must be added here to stay client-updatable — intentional").
-- meeting_booked_at is deliberately left out → service-role writes only.
alter table public.leads
  add column meeting_booked_at timestamptz;

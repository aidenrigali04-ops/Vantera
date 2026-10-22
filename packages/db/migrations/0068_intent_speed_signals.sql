-- 0068 (ML-8, 2026-10-21): speed-to-signal + a new warm signal for the Intent Agent.
--
-- 1) agents.cadence gains 'intraday': the Intent Agent may run every 6 hours so a high-intent
--    moment is caught within hours, not the next day. LinkedIn read volume stays flat — the
--    pipeline divides the per-run post budget by the runs per day (rule 04: read ceilings are
--    non-configurable). Postgres named the inline 0007 check agents_cadence_check.
alter table public.agents drop constraint if exists agents_cadence_check;
alter table public.agents add constraint agents_cadence_check
  check (cadence in ('daily', 'weekly', 'intraday'));

-- 2) intent_observations.signal_kind gains 'follow': people who started following the connected
--    LinkedIn profile. A follow has no words, so it never enters the buying-intent classifier; it
--    still passes the same suppression → ICP rules gate → AI rank bar before any outreach, and the
--    rank sees it as a 'follow' signal (never 'intent'). One observation per follower, ever —
--    ledger key (profile, synthetic post ref 'follow'). No retention change: rows keep the
--    table's existing window.
alter table public.intent_observations drop constraint if exists intent_observations_signal_kind_check;
alter table public.intent_observations add constraint intent_observations_signal_kind_check
  check (signal_kind in ('engagement', 'content', 'follow'));

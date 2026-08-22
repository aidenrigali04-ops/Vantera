-- 0064: why a draft was rejected (Dashboard blueprint v1.0 §6.8.1 / v2 §11.3 rejection learning).
--
-- The Today queue's inline Reject replaces a modal with four reason chips — wrong person,
-- bad timing, weak message, other. The reason rides the draft row itself (status 'canceled'
-- + rejection_reason) so the Playbook learning loop can later read "3 rejections look alike"
-- straight off scheduled_sends without a side table. Nullable: every other cancel path
-- (suppression, sequence stop, decline without a reason) leaves it null.
--
-- Writes go through the existing scheduled_sends_manage policy (admin members), exactly
-- like status/body edits from the review queue — the table has no column-scoped grant
-- lockdown, so no grant statement is needed. No retention change: the row already
-- follows scheduled_sends' window.
alter table public.scheduled_sends
  add column rejection_reason text
    check (rejection_reason in ('wrong_person', 'bad_timing', 'weak_message', 'other'));

-- Per-account email sign-off sender name.
--
-- The email copy brain emits the literal "{{sender_name}}" placeholder in the
-- sign-off (it cannot know the per-account human sender); the send path
-- substitutes this value before the email leaves. Without a real value the send
-- path strips the token, so a missing name never ships raw to a prospect.
--
-- Client-settable in Settings → Channels, so it gets a column-level UPDATE grant
-- (same pattern as 0012/0013). `public.accounts` is already RLS-protected
-- (0000/0001 with the is_account_admin write policy) — no new policy needed.
alter table public.accounts add column sender_name text;

grant update (sender_name) on public.accounts to authenticated;

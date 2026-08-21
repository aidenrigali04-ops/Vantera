-- 0061: seller-authored positioning — the seller's own value proposition, brand voice, and
-- guardrails, fed into the copy/reply brains via leadBlock. All nullable; blank = prior behavior
-- (valueProp falls back to the website-scan summary; voice/guardrails are simply omitted).
-- Captured at onboarding (value prop, scan-prefilled) and Settings › Positioning (all three).
alter table public.accounts add column if not exists value_prop text;
alter table public.accounts add column if not exists brand_voice text;
alter table public.accounts add column if not exists guardrails text;

-- accounts table-level UPDATE was revoked in 0013; each client-writable column needs its own
-- column grant (see 0007/0010/0012/0019/0039). The accounts_update RLS policy (0001) already
-- restricts WHICH rows (workspace admins); this grants WHICH columns.
grant update (value_prop, brand_voice, guardrails) on public.accounts to authenticated;

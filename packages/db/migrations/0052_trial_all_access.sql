-- 0052 (L5 two-plan restructure): new signups trial the All Access plan (internally the
-- `growth` tier — 5 senders, Intent agent) instead of starter. Existing accounts untouched.
alter table accounts alter column plan set default 'growth';

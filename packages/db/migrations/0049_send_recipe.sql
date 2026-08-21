-- 0049: message-level recipe attribution (Vera Stage 1, spec 2026-07-14).
-- Every agent-drafted scheduled_send is stamped at draft time with the recipe that
-- produced it: {v, brain, strategy, experimentId, variant, playbookVersion, exemplars}.
-- NULL = drafted before this migration OR human-typed (origin 'manual') — attribution is
-- never backfilled or invented (honesty rule). Service-role write only (the drafting
-- pipelines); members read via the existing scheduled_sends select policy — no client
-- write grant on purpose (column-grant gotcha, 0038→0039).
alter table scheduled_sends add column if not exists recipe jsonb;

comment on column scheduled_sends.recipe is
  'Draft-time recipe stamp (SendRecipe v1): {v, brain, strategy, experimentId, variant, playbookVersion, exemplars}. Null = pre-Stage-1 row or human-typed message.';

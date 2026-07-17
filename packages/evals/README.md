# @vantera/evals

An offline evals harness for the SDR agent brains: it runs fixture prospects and conversation
threads through the pure brain modules imported from `@vantera/agent-brains` (drafting, grading,
and the humanizer/grounding graders such as `findActionClaims`, `findUnapprovedLinks`, and
`validateConversationMessage`), then scores the outputs against expected behavior — no
Trigger.dev, no drizzle, no DB, same purity contract as the brains it exercises (rule 13). Any
suite that calls a real model goes through `getModel()`/`registerPrompt()` from `@vantera/ai`
(never `@ai-sdk/*` directly, per the single-entry guardrail) and is **API-key-gated**: it needs a
live `ANTHROPIC_API_KEY` (or equivalent provider credential) in the environment to run, and skips
itself cleanly when that key is absent so `pnpm test` stays green in CI and on machines without
the key configured.

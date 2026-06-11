# Help copilot (locked 2026-06-11)

An in-platform LLM copilot overlay on every dashboard page: answers questions, guides users (highlight walkthroughs), and takes actions with tiered confirmation. Full design: `docs/superpowers/specs/2026-06-11-help-copilot-design.md`.

## Locked decisions
- **Runtime**: `packages/help-agent` (agent core, tool registry, system prompt) + one streaming Next.js route (`/api/copilot`), Vercel AI SDK tool loop via the single Anthropic client wrapper. Trigger.dev is not in the chat path.
- **Action tiers**: `read`/`navigate` auto-execute; `mutate` confirms in-chat (30s undo when reversible); `critical` always confirms — billing is deep-link-only. All executions audited in `copilot_actions`.
- **Guide vs. do**: when asked "how do I…", offer a highlight walkthrough alongside one-click execution. Teaching is the default posture pre-activation.
- **Restriction model (whitelist by construction)**: agent context = `packages/help-content` knowledge pack + typed tool DTOs over the user's own data. Never raw DB rows, never other tenants, never build/backend/security internals, never vendor names (Smartlead, Unipile, Explorium stay white-labeled). `accountId` comes from the validated session server-side. Refusal lane + red-team CI fixture are defense-in-depth, not the primary control.

## Knowledge-sync rule (applies to ALL feature work)
**A feature is not done until its help-content article ships.** Any PR that adds or changes user-facing behavior must include the matching article in `packages/help-content` (markdown + `title`/`surface`/`routes` frontmatter) in the same PR, and register any new copilot tools for that feature. The knowledge-gap log (`copilot_knowledge_gaps`) is the authoring backlog.
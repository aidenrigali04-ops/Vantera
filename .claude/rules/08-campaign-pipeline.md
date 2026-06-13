# SDR agents & outreach pipeline (rewritten 2026-06-11; supersedes the campaign-wizard front door)

**Agents are the front door.** Users deploy named SDR agents; deploying a Prospect (Scout) Agent and an Outreach Agent is what drives all outreach. Campaigns still exist as the **internal execution grouping** (an Outreach agent's drafts hang off one auto-created campaign row) but are **never the primary user surface** — the agent card is. Spec: `docs/superpowers/specs/2026-06-11-sdr-agents-design.md`.

> **Naming (2026-06-12):** the agent formerly labeled "Copy Agent" is now the **Outreach Agent** on every user-facing surface. Internals are unchanged: `agents.kind = 'copy'`, `packages/agent-brains/src/copy/`, `copy-draft` pipeline, `agents-copy.md` help slug. It owns everything after the qualification gate (score ≥ min_score): copywriting now, plus sending and reply handling when Phase 5 lands — one agent, never a separate "sending agent".

## Agent setup wizards (the front door)

### Prospect Agent (kind `scout`)
```
Name Your Agent → ICPs → Run scheduler → Finish → Deploy <name>
```
- **ICP step is a type-ahead, not a select** — free text, **max 3 selections**, and the onboarding ICP (`accounts.onboarding_icp`) is always offered as a pre-built default chip.
- **Run scheduler**: time picker + cadence (**every day / every week**), timezone from the browser.
- **Deploy** flips status to **Live** — shown as the agent's custom name with a live status indicator. First run starts within ~15 minutes (null `next_run_at` = due); later runs follow the schedule.
- One agent per kind per account in v1 (DB unique constraint).

### Outreach Agent (kind `copy`)
```
Name Your Agent → ICP (read-only, inherited from Scout) → CTA → Add Content → enable LinkedIn / enable Email → Finish → Deploy
```
- Requires a deployed Scout (it writes to the Scout's leads); targeting shown read-only — a confirmation step, never re-entered.
- **CTA** is free text with example chips — the one input only the user knows (what a reply should lead to).
- **Add Content**: optional with a skip path — file/image uploads to the private `agent-assets` bucket + pasted links, referenced as context by the copy brains.
- ≥1 channel required. Deploy auto-creates the internal campaign (`copywriting_mode: 'agent'`, `send_mode: 'review'`); the deploy summary states what happens next (drafts as leads qualify, everything waits in review).
- **Wizard scope rule**: steps collect only *identity, goal, or context*. Strategy and mechanics (tone, sequencing, pacing, send schedules) belong to the brain or the review queue — never wizard inputs.

### Caller Agent (kind `caller`)
```
Name Your Agent → Targeting (read-only, inherited from Scout) → Goal & Booking link → Voice & Identity → Add Content → Calling Window → Deploy
```
- **Requires a deployed Scout agent**; inherits its ICPs and qualification gate. Only leads scoring ≥ `min_score` with a validated phone are eligible for a call.
- **Wizard scope rule**: same as Outreach — steps collect only identity, goal, content context, and the calling window. Conversation strategy belongs to the brain; timing and retry mechanics belong to the scheduler.
- **Behavior contract**: as leads qualify, the brain drafts a per-lead **call brief** (`call_briefs.status = 'pending_review'`). The calling system places no call until the brief is approved in the review queue. Dispatch places calls exclusively within the configured calling window, timed to the prospect's local timezone. Outcomes (`booked`, `callback`, `not_interested`, `no_answer`, `voicemail`, `do_not_call`) are classified by the calling system after each call ends. `not_interested` and `do_not_call` write the number to the suppression list immediately — no manual step required.

## Agent behavior contract after deploy

1. **Scheduler** (Trigger.dev cron, every 15 min) scans live Scout agents by `agents.next_run_at` — schedule state lives in our DB; pause is a status flip.
2. **Scout run** (rules 05/06): discovery via the `prospect-data` interface per ICP → **deterministic rules gate** → **enrichment spent on survivors only** (email, phone, LinkedIn, firmographics, technographics, signals) → **batched AI rank** via `@vantera/ai` writing `ai_score`, `ai_rationale`, and structured `ai_insights` (pain points, triggers, motivations, value angle, aha moment, summary). A website scan of `accounts.website_url` (cached 30 days) feeds seller context.
3. **Copy run**: qualified leads (score ≥ min_score, default 70) chain into the Outreach agent. **Suppression is checked before every draft on every channel** (rule 11). Two separate copy systems (email / LinkedIn) personalize from `ai_insights` + the user's CTA + content; a deterministic humanizer linter with one bounded regenerate keeps the copy human — unresolved flags surface in the review queue.
4. **The pipeline stops at the drafted queue**: `scheduled_sends.status = 'pending_review'`. Live sending, send modes (automatic + preview, manual draft, user-drafted copy), and reply handling arrive with the Phase 5 channel adapters; suppression is checked again at that send boundary.

## Carried-over invariants (still locked)

- Targeting type-ahead, max 3, onboarding default — now in the Scout wizard.
- Run time + cadence (daily/weekly) — now in the Scout wizard.
- Live status indicator with the agent's custom name.
- Channel safety limits (rule 04) live in the scheduler once sends go live.
- No vendor names on any agent surface (rules 03/04/05).

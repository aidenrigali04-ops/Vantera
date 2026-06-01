# Vantera — Phase 2: Sales Intelligence
# Cursor Master Reference Document

> **Canonical spec for all Phase 2+ sales intelligence work.**
> Build files in the exact order listed in BUILD ORDER.
> Never skip a step. Verify TypeScript after every file.

Implementation status: `.cursor/current-phase.md`

---

## ENGINEERING RULES — NON-NEGOTIABLE

```
MULTI-TENANCY    Every DB query filters by accountId from JWT session only.
SOFT DELETES     Never db.delete(). Set deletedAt = now().
API SHAPE        { success: true, data: T } | { success: false, error, code? }
AI GATING        Team = assist only. Enterprise = autonomous_ai_messaging flag.
FEATURE FLAGS    lead_scoring, ai_message_drafting (both). autonomous_ai_messaging (Enterprise).
COMPONENTS       "use client" only when needed. Loading + empty + error states.
LOGGING          AI actions → automation_runs. Auto sends → signals + activities.
SESSION          Admin session only in /admin. Portal session only in /portal.
```

---

## BUILD ORDER — STRICT

```
Step  File                                    Status
────  ───────────────────────────────────     ──────────────────────────────
 1    packages/db/schema.ts                   DONE (0010 migration)
 2    lib/aspire/types.ts                     DONE
 3    lib/aspire/icp-score.ts                 DONE
 4    lib/aspire/search.ts                    DONE (Apollo + stub fallback)
 5    lib/ai/draft-message.ts                 DONE
 6    lib/aspire/enroll.ts                    DONE
 7    jobs/draft-on-enroll.ts                 DONE
 8    jobs/aspire-weekly-search.ts            DONE
 9    jobs/daily-lead-score.ts                DONE
10    app/api/aspire/* routes                 DONE
11    app/(admin)/aspire/page.tsx             Partial (existing UI, ICP wiring next)
12    app/api/webhooks/resend/route.ts        DONE
13    app/api/drafts/[id]/approve/route.ts    DONE
14    components/dashboard/action-feed.tsx    DONE (signal types)
15    Deploy Trigger.dev jobs                 Pending
```

---

## Adaptations from spec

- Uses `leads` table (not contacts/records) for pipeline — matches Vantera dual data model
- `aspire_saved_searches` extended in place (not renamed to `aspire_searches`)
- `lead_drafts.leadId` and `lead_scores.leadId` instead of contactId
- Enroll triggers `draft-on-enroll` via Trigger.dev with inline fallback when unavailable

---

## Per-customer outreach domains

Each account can verify its own sending domain in **Settings → Outreach email domain**:
- **From:** `{localPart}@{customerDomain}` (e.g. `outreach@acmehvac.com`)
- **Reply-To:** `replies+{stepId}@inbound.{customerDomain}` (MX on inbound subdomain)
- Falls back to platform `NEXT_PUBLIC_APP_DOMAIN` until verified

Requires `RESEND_API_KEY` with domain API access. One Resend account, many verified domains.

---

## ENV VARS

```bash
APOLLO_API_KEY=          # Apollo.io → Settings → Integrations → API keys
RESEND_WEBHOOK_SECRET=   # Resend dashboard → Webhooks → Signing secret
TRIGGER_SECRET_KEY=      # Trigger.dev deploy + task triggers
```

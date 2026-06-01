# Vantera

White-label automated sales intelligence platform.

## Monorepo

Turborepo + pnpm workspaces.

```
vantera/
├── apps/web/          # Next.js 14 — admin, portal, auth, API
├── packages/db/       # Drizzle schema (source of truth)
├── packages/types/    # Shared TypeScript types
└── packages/utils/    # Shared utilities
```

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) 9+

## Setup

```bash
pnpm install
```

Copy environment variables when they are introduced (`.env.example` in a later step).

## Sales intelligence architecture

Vantera is an automated sales intelligence system organized as **Nurture → Sell → Deliver**:

| Stage | Route | Purpose |
|-------|-------|---------|
| **Deliver** — Active Clients | `/admin/clients` | Post-conversion client lifecycle |
| **Sell** — Pipeline | `/admin/pipeline` | Pre-conversion prospect management |
| **Nurture** — Aspire | `/admin/outreach/aspire` | Prospect discovery and enrichment |
| **Nurture** — LinkedIn | `/admin/outreach/linkedin` | Campaigns and sequences |

Legacy routes (`/admin/contacts`, `/admin/records`, `/admin/leads`, `/admin/crm/*`) redirect to the routes above.

The separate [crm-dashboard](https://github.com/aidenrigali04-ops/crm-dashboard) repo remains the agent monitor — not merged into this monorepo.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev servers via Turbo |
| `pnpm build` | Production build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm type-check` | TypeScript check all packages |

## Packages

| Package | Description |
|---------|-------------|
| `@vantera/web` | Next.js application |
| `@vantera/db` | Drizzle ORM schema and migrations |
| `@vantera/types` | Shared types |
| `@vantera/utils` | Shared utilities |

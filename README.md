# Vantera

White-label multi-tenant business operations platform.

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

## Four-service architecture

Vantera is organized around four core modules:

- **CRM — Active Clients** (`/admin/crm/clients`) — post-conversion client lifecycle
- **Lead Pipeline / LMS** (`/admin/crm/pipeline`) — pre-conversion prospect management
- **Aspire** (`/admin/outreach/aspire`) — prospect discovery and enrichment
- **LinkedIn Automation** (`/admin/outreach/linkedin`) — campaigns and sequences

Legacy routes (`/admin/contacts`, `/admin/records`, `/admin/leads`) redirect to the CRM hub.

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

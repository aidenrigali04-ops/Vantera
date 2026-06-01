# Phase 5 — CRM Integrations

Connect HubSpot, GoHighLevel, and Salesforce to import and export pipeline leads.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/integrations` | Connect CRMs, import/export leads, CSV export |
| `/api/leads/export` | Download pipeline leads as CSV (`?ids=` for selection) |

## Architecture

```
apps/web/lib/integrations/
├── types.ts              # Provider types, labels
├── connect.ts            # Connect/disconnect with credential validation
├── queries.ts            # Connection status lookup
├── enrichment.ts         # External ID mapping in leads.enrichment JSON
├── actions.ts            # Server actions (connect, import, export)
├── hubspot/client.ts     # HubSpot API (@hubspot/api-client)
├── gohighlevel/client.ts # GHL REST API
├── salesforce/client.ts  # Salesforce SOQL + Lead create
└── sync/leads.ts         # importLeadsFromCrm / exportLeadsToCrm
```

## Auth model (v1)

Per-workspace tokens stored in `integration_credentials` (not env vars):

- **HubSpot** — Private app access token
- **GoHighLevel** — API key + Location ID
- **Salesforce** — Instance URL + access token (+ optional refresh token)

OAuth flows are a future enhancement.

## External ID mapping

Stored in `leads.enrichment`:

```json
{
  "externalIds": { "hubspot": "...", "gohighlevel": "...", "salesforce": "..." },
  "crmSync": { "hubspot": { "lastImportedAt": "...", "lastExportedAt": "..." } }
}
```

## Migration

```bash
pnpm --filter @vantera/db build
pnpm db:apply packages/db/migrations/0011_crm_lead_sources.sql
```

Adds `hubspot`, `gohighlevel`, `salesforce` to `lead_source` enum.

## UI entry points

- Integrations page — connect cards with Import/Export per provider
- Pipeline — "CRM sync" header link, bulk "Export CSV"
- CSV import — existing dashboard import flow

## Future

- OAuth for HubSpot / Salesforce
- Scheduled bi-directional sync (Trigger.dev)
- Update existing CRM records on re-export

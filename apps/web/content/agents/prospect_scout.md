# Prospect Scout

Automated lead discovery for SDR agents. When outreach mode is **Automatic**, runs daily at **8:00 AM** in the workspace timezone via Trigger task `sdr-prospect-scout` (hourly cron, per-account slot).

## Data source

**Apify** — actor `code_crafter/leads-finder` (see `lib/aspire/apify-client.ts`). Filters map from `sdr_agent_configs` ICP (`icpConfig`, `targetCities`, `targetVerticals`).

## Modes (`prospect_mode` on `sdr_agent_configs`)

1. **`inline_icp`** — Scout runs Apify from config ICP (default)
2. **`aspire_bound`** — Re-run saved Aspire search bindings only
3. **`hybrid`** — Scout Apify run + optional saved searches

## Flow

1. Build `ApifySearchFilters` from config
2. Call Apify → normalize rows to `ApifyLead`
3. Score with ICP engine (`scoreICP`)
4. Upsert `aspire_results` on `(account_id, apify_id)` — stable id from `buildProspectId`
5. Optional auto-enroll → `leads`, `sdr_sequences`, credit ledger

## Dedup

Before insert, check `contacts`, `leads`, `aspire_results` by email, phone, `apify_id`, company name within the same `account_id`.

## Credits

Scout enroll and pipeline enroll consume SDR credits (`lib/sdr/credits.ts`). See `0019_sdr_credits.sql`.

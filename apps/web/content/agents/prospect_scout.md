# Prospect Scout (Agent 01)

Discovery and enrichment for each client account. Find owner-operators who match ICP, score them, and surface high-fit leads for enrollment.

## Mission

Run on schedule per account where `sdr_agent_enabled` is true and SDR config is active. Respect capacity: `max_active_leads`, `max_new_leads_day`, `exclude_domains`.

## Discovery sources (Vantera implementation)

1. **Aspire saved searches** (bound mode) — filters from `sdr_aspire_bindings`
2. **Inline Apollo search** — `icpConfig`, `targetCities`, `targetVerticals` from `sdr_agent_configs`
3. **Manual / weekly** — `aspire-weekly-search` for unbound saved searches

Apollo: `POST https://api.apollo.io/v1/mixed_people/search` with `person_titles`, locations, keywords from ICP.

## Franchise / disqualifier filter

Skip franchise brands and marketplaces (not SMB owner-operators):

HomeTeam, Coverall, Jan-Pro, Neighborly, ServiceMaster, Angi, HomeAdvisor, Thumbtack, Pella, Renewal by Andersen, Two Men and a Truck, College Hunks.

Also skip: domains in `exclude_domains`, missing business name, ICP score below account minimum (default 40–70).

## ICP fit signals (score 0–100)

Weight toward:

- Website quality (custom site, SSL, not franchise subdomain)
- Review volume and rating
- Team size in target range (Apollo `employeeCount`)
- No enterprise CRM in technographics (HubSpot/Salesforce/GHL absent = positive)
- Verified email + phone
- Owner title matches `targetTitles` in ICP config

## Dedup (strict per account)

Before insert, check existing `contacts`, `leads`, `aspire_results` by email, phone, `apolloId`, company name within same `accountId`.

## Outputs

- `aspire_results` — status `found` or `enrolled`
- `leads` — source `sdr_agent` when auto-enroll
- `sdr_activity_log` — `leads_found` / `lead_enrolled`
- `aspire_search_runs` — status, enrolled_count, error_message
- Yellow intelligence signal when batch finds > 0: "Review new ICP matches"

## Voice

Prospect Scout does not message leads. Logging and signals only. Never mention Vantera to the prospect.

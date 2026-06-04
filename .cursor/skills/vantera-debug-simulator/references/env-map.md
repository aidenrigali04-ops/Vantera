# Environment Map — Vantera Debug Simulator

## Environment Variables Expected in Runtime

| Variable | Used For | Where Set |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Vercel env + local .env |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB operations (bypasses RLS for test reads) | Vercel env (never client-side) |
| `SUPABASE_ANON_KEY` | Client-scoped auth calls | Vercel env + client bundle |
| `STRIPE_SECRET_KEY` | Invoice / payment API calls | Vercel env |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Vercel env |
| `TWILIO_ACCOUNT_SID` | SMS delivery | Vercel env |
| `TWILIO_AUTH_TOKEN` | SMS auth | Vercel env |
| `TWILIO_PHONE_NUMBER` | Outbound SMS sender | Vercel env |
| `SENDGRID_API_KEY` | Transactional email | Vercel env |
| `ANTHROPIC_API_KEY` | AI Service calls | Vercel env / AI service env |
| `TRIGGER_API_KEY` | Trigger.dev job management | Vercel env |
| `TRIGGER_API_URL` | Base URL for Trigger.dev | https://api.trigger.dev |
| `GITHUB_TOKEN` | GitHub API access | CI / local .env |
| `GITHUB_REPO` | e.g. org/vantera-app | CI / local .env |
| `NEXT_PUBLIC_PORTAL_BASE_URL` | Base URL for portal links in messages | Vercel env |
| `INTERNAL_API_BASE_URL` | Base URL for Core API | Vercel env |

## Base URLs

```
Core API:          $INTERNAL_API_BASE_URL/api/v1
Portal (default):  https://{account.slug}.vanterasystem.dev
Portal (CNAME):    https://{account.portal_domain}
Supabase:          $SUPABASE_URL
Trigger.dev:       https://api.trigger.dev/api/v1
GitHub:            https://api.github.com/repos/$GITHUB_REPO
Vercel:            via Vercel MCP (no manual URL needed)
```

## Test Account IDs

> Update these to real seed/test account IDs in your development database.

```
TEST_ACCOUNT_ID_TEAM=<uuid>         # A Team plan account (HVAC vertical)
TEST_ACCOUNT_ID_ENTERPRISE=<uuid>   # An Enterprise plan account
TEST_CONTACT_ID_A=<uuid>            # Contact in TEST_ACCOUNT_ID_TEAM
TEST_CONTACT_ID_B=<uuid>            # Different contact, same account
TEST_CONTACT_ID_OTHER_ACCOUNT=<uuid> # Contact in a different account (used for isolation tests)
TEST_USER_ID_OWNER=<uuid>           # Owner role user
TEST_USER_ID_STAFF=<uuid>           # Staff role user
TEST_PORTAL_DOMAIN=<slug>.vanterasystem.dev
```

## Curl Templates

### Authenticated API Call
```bash
curl -s -X GET "$INTERNAL_API_BASE_URL/api/v1/records" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json"
```

### Trigger.dev Job Invocation
```bash
curl -s -X POST "$TRIGGER_API_URL/jobs/{job-slug}/trigger" \
  -H "Authorization: Bearer $TRIGGER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"account_id": "$TEST_ACCOUNT_ID_TEAM", "test_run": true}}'
```

### GitHub CI Status Check
```bash
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/$GITHUB_REPO/commits/HEAD/check-runs" \
  | jq '.check_runs[] | {name, status, conclusion}'
```

### Supabase Service Role Query (admin read, bypasses RLS)
```bash
curl -s "$SUPABASE_URL/rest/v1/records?select=id,account_id&limit=5" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

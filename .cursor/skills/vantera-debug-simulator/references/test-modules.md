# Test Modules — Vantera Debug Simulator

## T1 — Auth Flows

### T1.1 — Signup Flow
```
Method: POST
Endpoint: /api/auth/signup (or Supabase auth.signUp)
Payload: { email: "debug-test-{timestamp}@vantera-test.internal", password: "DebugTest123!" }
Expected: 200 | user created | session token returned
Check: user row exists in auth.users, account_id scoped correctly
Cleanup: DELETE test user after verification
```

### T1.2 — Login + Session Scoping
```
Method: POST
Endpoint: Supabase auth.signInWithPassword
Payload: test credentials from T1.1
Expected: access_token returned, JWT contains account_id claim
Check: Decode JWT — verify account_id is present and non-null
```

### T1.3 — Magic Link Generation
```
Method: POST
Endpoint: /api/auth/magic-link
Payload: { email: "existing-contact@test.internal" }
Expected: 200, magic link issued (check Supabase auth.magic_link_tokens or equivalent)
Check: Link is single-use flag set, expires_in ≤ 3600s
```

### T1.4 — Portal Auth Scope Isolation
```
Simulate: Contact A logs in → attempts to fetch Contact B's records
Method: GET /api/v1/records?contact_id=<contact-B-id>
Auth: Contact A's JWT
Expected: 403 OR empty result set (never Contact B's data)
CRITICAL: Any 200 with Contact B data = CRITICAL isolation failure
```

### T1.5 — Token Refresh
```
Method: POST /api/auth/refresh
Payload: { refresh_token: <valid refresh token> }
Expected: new access_token returned, old token invalidated
Check: expiry on new token = now + 900s (15 min)
```

---

## T2 — Database + RLS Policy Checks

### T2.1 — account_id Row Isolation
```
Via Supabase MCP: Run as tenant A's role
Query: SELECT * FROM records WHERE true  (no account_id filter)
Expected: Returns ONLY tenant A's rows (RLS enforces account_id = auth.uid())
CRITICAL: Any cross-tenant rows = CRITICAL data leak
```

### T2.2 — RLS Policy Existence Check
```
Via Supabase MCP:
Query: SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
Expected: Every core table has at least one SELECT policy
Tables to verify: accounts, users, contacts, records, activities, automations, messages, invoices, documents, intelligence_signals
Flag: Any table missing a policy
```

### T2.3 — Soft Delete Enforcement
```
Via Supabase MCP: Attempt hard DELETE on records table
Query: DELETE FROM records WHERE id = '<test-record-id>'
Expected: Row still exists with deleted_at set (trigger handles this), OR RLS blocks raw DELETE
Flag: If row is actually gone from table = hard delete occurred = BUG
```

### T2.4 — Intelligence Signal Expiry
```
Via Supabase MCP:
Query: SELECT COUNT(*) FROM intelligence_signals WHERE expires_at < now() AND is_dismissed = false
Expected: 0 (expired signals should be cleaned up by scheduled job)
Flag: Any count > 0 means the cleanup job is failing
```

### T2.5 — Churn + Upsell Score Range
```
Via Supabase MCP:
Query: SELECT id FROM contacts WHERE churn_risk_score NOT BETWEEN 0 AND 100 OR upsell_score NOT BETWEEN 0 AND 100
Expected: 0 rows
Flag: Out-of-range scores = AI Service returning invalid values
```

### T2.6 — Stage Definition Completeness
```
Via Supabase MCP:
For each account: verify at least one is_terminal_win and one is_terminal_loss stage_definition exists
Query: SELECT account_id FROM accounts a WHERE NOT EXISTS (
  SELECT 1 FROM stage_definitions WHERE account_id = a.id AND is_terminal_win = true
)
Expected: 0 rows
```

---

## T3 — API Endpoint Smoke Tests

For each endpoint, use web_fetch with a valid test JWT. Verify HTTP status and response shape.

### T3.1 — Records CRUD
```
GET  /api/v1/records                    → 200, array
POST /api/v1/records <minimal payload>  → 201, record with id
GET  /api/v1/records/:id                → 200, record object
PATCH /api/v1/records/:id { stage_id } → 200, updated record
  → Side effect: activity row inserted with type=stage_change
  → Side effect: automation engine received stage_changed event
DELETE /api/v1/records/:id (soft)       → 200, deleted_at set (not hard delete)
```

### T3.2 — Contacts Endpoints
```
GET  /api/v1/contacts                   → 200, array
POST /api/v1/contacts <payload>         → 201, contact with portal_access=false default
GET  /api/v1/contacts/:id/intelligence  → 200, { ltv_cents, churn_risk_score, upsell_score, tags }
```

### T3.3 — Automations Endpoints
```
GET  /api/v1/automations                → 200, array
PATCH /api/v1/automations/:id { is_active: false } → 200
GET  /api/v1/automations/:id/logs       → 200, array (may be empty)
```

### T3.4 — Intelligence Signals
```
GET  /api/v1/intelligence/signals       → 200, array of signals with severity field
POST /api/v1/intelligence/signals/:id/dismiss → 200
  → Side effect: dismissed_by_user_id populated, is_dismissed = true
```

### T3.5 — Forecasting
```
GET  /api/v1/forecasting/revenue?horizon_days=30 → 200, { low, mid, high, assumptions[] }
```

### T3.6 — Auth Header Enforcement
```
Call any /api/v1/ endpoint with NO Authorization header
Expected: 401 Unauthorized
Call with malformed JWT
Expected: 401 Unauthorized
Call with valid JWT from different account accessing another account's record
Expected: 403 or 404 (never 200 with data)
```

---

## T4 — Edge Function Cold Start Tests

### T4.1 — Supabase Edge Functions
```
Via Supabase MCP: List all deployed edge functions
For each function:
  - Invoke with minimal valid payload
  - Measure response time
  - Expected: < 3000ms cold start (flag if > 3s)
  - Expected: No 5xx on valid payload
Key functions to test:
  - signal-evaluator (AI signal generation)
  - automation-dispatcher (trigger evaluation)
  - message-sender (notification routing)
```

### T4.2 — Vercel Serverless Functions
```
Via Vercel MCP: Pull function list from latest deployment
For each /api/* route:
  - Verify function appears in deployment
  - Check for recent 5xx errors in logs (last 1 hour)
  - Flag any function with error rate > 5%
```

### T4.3 — Cold Start Regression Check
```
Via Vercel MCP: Compare P95 function duration from last 2 deployments
If P95 increased > 500ms: flag as performance regression
```

---

## T5 — Trigger.dev Job Simulation

### T5.1 — Job Registry Check
```
Via Trigger.dev API:
GET https://api.trigger.dev/api/v1/jobs
Headers: Authorization: Bearer $TRIGGER_API_KEY
Expected: All expected Vantera jobs registered and enabled
Required jobs:
  - automation-engine.missed-call-capture
  - automation-engine.stage-changed
  - automation-engine.invoice-overdue-scan
  - automation-engine.portal-inactivity-scan
  - automation-engine.date-relative-scan
  - ai-service.signal-evaluator
  - notification-service.send-sms
  - notification-service.send-email
Flag: Any expected job missing or in "disabled" state
```

### T5.2 — Recent Run Failure Check
```
Via Trigger.dev API:
GET https://api.trigger.dev/api/v1/runs?status=FAILED&limit=20
Expected: 0 failed runs in last 24h
For each failure found:
  - Capture job name, error message, payload
  - Include in RCA
```

### T5.3 — Missed Call Simulation
```
Via Trigger.dev API: Trigger test run of missed-call-capture job
Payload: {
  "account_id": "<test-account-id>",
  "phone": "+12065550001",
  "timestamp": "<now>",
  "test_run": true
}
Expected:
  - Job completes with status COMPLETED
  - records row created (or existing contact matched)
  - messages row created with direction=outbound, channel=sms
  - activities row created with activity_type=automation_fired
  - Delivery within 90 seconds (check job duration)
```

### T5.4 — Invoice Overdue Scan
```
Via Trigger.dev API: Trigger invoice-overdue-scan with test_run=true
Expected:
  - Job scans for invoices where due_at < now AND status != paid
  - For each found: automation action queued (send_sms)
  - Job duration < 30s for typical account size
```

---

## T6 — UI Interaction Flow Simulation

These are performed via web_fetch against the live portal domain.

### T6.1 — Client Portal Home Load
```
GET https://<portal_domain>/
Expected: 200, HTML contains brand name (NOT "Vantera"), no Vantera logo URLs
Check: Response does not contain "vantera" in visible text content
CRITICAL: Any "Vantera" branding in client-facing HTML = CRITICAL bug
```

### T6.2 — Portal Auth Wall
```
GET https://<portal_domain>/dashboard (unauthenticated)
Expected: Redirect to login page (302) or 401
NOT expected: 200 with dashboard content
```

### T6.3 — Estimate Approval Flow
```
Simulate: Contact receives estimate → approves via portal
1. Create test estimate record via API (requires_signature=true, visible_to_client=true)
2. Fetch portal document view endpoint with contact's JWT
3. POST approval action
4. Verify: activities row inserted with type=estimate_approved
5. Verify: admin Kanban receives stage update (via webhook or polling)
```

### T6.4 — Invoice Pay Link
```
GET <invoice.payment_link_url> from a test invoice
Expected: 200, Stripe-hosted or portal pay page loads
Expected: Invoice amount matches records.value_cents
```

### T6.5 — Portal Inactivity Signal
```
Simulate: Set contacts.portal_last_login_at = 15 days ago for test contact
Trigger portal-inactivity-scan job (test_run=true)
Expected: intelligence_signal created with signal_type=churn_risk, severity=red
Expected: Signal visible via GET /api/v1/intelligence/signals
```

---

## T7 — Automation Workflow E2E (Vantera-Specific)

Full end-to-end simulation of a vertical workflow. Default: HVAC.

### T7.1 — HVAC Full Job Lifecycle
```
Step 1: Create record with stage = "New Call"
  → Expect: record_created trigger fires
  → Expect: welcome SMS queued (if automation configured)

Step 2: Move record to "Estimate Sent"
  → Expect: stage_changed trigger fires
  → Expect: estimate_followup automation activates

Step 3: Simulate 4 days passing (set records.updated_at = now - 4 days)
  → Trigger date-relative-scan
  → Expect: follow-up SMS queued (day 1 missed, now day 4 = email queued)

Step 4: Move record to "Completed"
  → Expect: post_job_review automation fires (2hr delay)
  → Expect: invoice created or invoice_sent trigger fires

Step 5: Verify automation_runs table
  → All steps above should have automation_runs entries with status=success
  → Any status=failed = BUG
```

### T7.2 — Automation Audit Trail Completeness
```
After T7.1: Query automation_runs
Expected: One row per automation action fired
Fields present: automation_id, trigger_event, action_type, status, executed_at, result_payload
Missing rows or null fields = BUG
```

### T7.3 — Feature Flag Enforcement (AI Messaging Gate)
```
Ensure test account has autonomous_ai_messaging = false (Team plan)
Attempt to invoke generate_ai_message action directly
Expected: Action is blocked / no message sent to contact
Expected: Error logged, not silently skipped

Ensure Enterprise test account has autonomous_ai_messaging = true
Same invocation
Expected: Message queued for delivery
```

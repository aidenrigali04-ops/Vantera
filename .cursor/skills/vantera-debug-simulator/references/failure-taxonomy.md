# Failure Taxonomy — Vantera Debug Simulator

## How to Use This File

When a test fails, match the error to a pattern below. Each entry has:
- **Signature**: What the error looks like
- **Root Cause**: Why this happens
- **Fix Template**: Exact code/SQL/config pattern to apply
- **Verify**: How to confirm the fix worked

---

## AUTH FAILURES

### A1 — Missing account_id in JWT
```
Signature: API returns 200 but data is cross-tenant OR JWT decode shows no account_id claim
Root Cause: Auth middleware not injecting account_id into JWT on login
Fix Template:
  File: src/lib/auth.ts (or equivalent session creation code)
  Add to JWT payload construction:
    account_id: user.account_id  // pulled from users table after auth
Verify: Decode new JWT → account_id present
```

### A2 — Magic Link Reuse
```
Signature: Same magic link works twice (T1.3 fails isolation check)
Root Cause: Token not invalidated on first use
Fix Template:
  File: src/app/api/auth/magic-link/verify/route.ts
  After successful verification:
    await supabase.from('magic_link_tokens').update({ used_at: new Date() }).eq('token', token)
    if (existing.used_at !== null) return NextResponse.json({ error: 'Link already used' }, { status: 401 })
Verify: Re-attempt same link → 401
```

### A3 — Portal Auth Not Scoped to contact_id
```
Signature: Contact A can see Contact B's records (T1.4 CRITICAL)
Root Cause: Portal JWT only carries account_id, not contact_id — RLS not restricting further
Fix Template (SQL):
  ALTER POLICY "contacts_select" ON contacts
  USING (account_id = auth.jwt()->>'account_id' AND id = auth.jwt()->>'contact_id');
  -- Also add contact_id to JWT at portal login
Fix Template (Code):
  // In portal auth handler, include contact_id in JWT
  { account_id: account.id, contact_id: contact.id, role: 'portal_contact' }
Verify: T1.4 re-run → Contact B's records not visible to Contact A
```

---

## DATABASE / RLS FAILURES

### D1 — Missing RLS Policy on Table
```
Signature: T2.2 finds a table with no pg_policies entry
Root Cause: Table created without RLS enabled or policy missing after migration
Fix Template (SQL):
  ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "{table_name}_account_isolation" ON {table_name}
    FOR ALL USING (account_id = (auth.jwt()->>'account_id')::uuid);
Verify: T2.2 re-run → table appears in pg_policies
```

### D2 — Hard Delete Occurring
```
Signature: T2.3 — row gone from table after DELETE
Root Cause: No soft-delete trigger, or code calling .delete() instead of .update({ deleted_at })
Fix Template (SQL trigger):
  CREATE OR REPLACE FUNCTION soft_delete_{table}()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE {table} SET deleted_at = now() WHERE id = OLD.id;
    RETURN NULL; -- prevent actual delete
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER prevent_hard_delete_{table}
  BEFORE DELETE ON {table}
  FOR EACH ROW EXECUTE FUNCTION soft_delete_{table}();
Fix Template (Code):
  // Replace: await supabase.from('records').delete().eq('id', id)
  // With:    await supabase.from('records').update({ deleted_at: new Date() }).eq('id', id)
Verify: T2.3 re-run → row still present with deleted_at set
```

### D3 — Score Out of Range
```
Signature: T2.5 finds contacts with scores outside 0–100
Root Cause: AI Service returning raw float or unvalidated number
Fix Template (Code — AI Service response handler):
  const clamp = (val: number) => Math.max(0, Math.min(100, Math.round(val)))
  contact.churn_risk_score = clamp(aiResponse.churn_risk_score)
  contact.upsell_score = clamp(aiResponse.upsell_score)
Fix Template (SQL constraint):
  ALTER TABLE contacts ADD CONSTRAINT churn_score_range
    CHECK (churn_risk_score BETWEEN 0 AND 100);
  ALTER TABLE contacts ADD CONSTRAINT upsell_score_range
    CHECK (upsell_score BETWEEN 0 AND 100);
Verify: T2.5 re-run → 0 rows returned
```

---

## API FAILURES

### API1 — Missing account_id Filter on GET Handler
```
Signature: T3.1 or T3.6 — cross-account records returned, or RLS is the only guard
Root Cause: Query builder not explicitly filtering by account_id (relying solely on RLS)
Fix Template:
  // In GET handler:
  const { account_id } = jwt.decode(token) // from auth middleware
  const { data } = await supabase
    .from('records')
    .select('*')
    .eq('account_id', account_id)  // explicit filter, defense-in-depth
    .is('deleted_at', null)         // exclude soft-deleted
Verify: T3.1 + T3.6 re-run → no cross-account data
```

### API2 — Stage Change Not Firing Automation Trigger
```
Signature: PATCH /records/:id with stage_id change → automation_runs table has no new entry
Root Cause: Stage update handler not emitting stage_changed event to automation engine
Fix Template:
  // After .update({ stage_id }) succeeds:
  await triggerClient.sendEvent({
    name: 'automation-engine.stage-changed',
    payload: {
      account_id,
      record_id: id,
      previous_stage_id: record.stage_id,
      new_stage_id: body.stage_id,
    }
  })
  // Also insert into activities:
  await supabase.from('activities').insert({
    account_id, record_id: id,
    actor_type: 'user', actor_id: userId,
    activity_type: 'stage_change',
    body: `Moved to ${newStage.label}`,
    visible_to_client: newStage.visible_to_client_on_entry ?? false,
  })
Verify: T3.1 stage move re-run → automation_runs entry exists, activity row exists
```

### API3 — Automation Dismiss Not Setting dismissed_by_user_id
```
Signature: POST /intelligence/signals/:id/dismiss → 200 but dismissed_by_user_id is null
Root Cause: Dismiss handler updating is_dismissed but not setting the actor
Fix Template:
  await supabase.from('intelligence_signals').update({
    is_dismissed: true,
    dismissed_by_user_id: userId  // extract from JWT
  }).eq('id', signalId)
Verify: T3.4 re-run → dismissed_by_user_id populated
```

---

## EDGE FUNCTION FAILURES

### E1 — Cold Start > 3s
```
Signature: T4.1 — edge function response time > 3000ms
Root Cause: Heavy imports at top level, unoptimized initialization, large bundle
Fix Template:
  // Move heavy imports inside handler, not top-level
  // Use dynamic imports for rarely-used modules:
  const { heavyLib } = await import('./heavy-lib')
  // Reduce bundle: check for unused imports in function file
Verify: Re-invoke function, measure response time < 3s
```

### E2 — Edge Function 5xx on Valid Payload
```
Signature: T4.1 returns 500 on valid invoke
Root Cause: Unhandled exception, missing env var, or schema mismatch in payload
Fix Template:
  // Add top-level try/catch to edge function handler:
  try {
    // existing logic
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
  // Check: all required env vars accessed at runtime (not build time)
Verify: Re-invoke → no 5xx, error message returned if invalid payload
```

---

## TRIGGER.DEV FAILURES

### TR1 — Job Not Registered
```
Signature: T5.1 — expected job missing from Trigger.dev job list
Root Cause: Job file not imported in trigger index, or deployment failed
Fix Template:
  // In trigger/index.ts (or equivalent entry point):
  export { missedCallJob } from './jobs/missed-call-capture'
  export { stageChangedJob } from './jobs/stage-changed'
  // etc — ensure all jobs exported
  // Then redeploy: npx trigger.dev deploy
Verify: T5.1 re-run → job appears in registry
```

### TR2 — Payload Shape Mismatch
```
Signature: T5.3/T5.4 job runs but fails with "undefined" field errors
Root Cause: Job expects field names that don't match what the sender provides
Fix Template:
  // Check job schema definition vs. what triggerClient.sendEvent sends
  // In job file — update schema to match actual payload:
  schema: z.object({
    account_id: z.string().uuid(),
    phone: z.string().optional(),
    test_run: z.boolean().optional().default(false),
    // match exactly what the emitter sends
  })
Verify: T5.3 re-run → job COMPLETED status
```

### TR3 — Missed Call Not Completing Within 90s
```
Signature: T5.3 — job completes but total duration > 90s
Root Cause: SMS send queued with unnecessary delay, or Twilio call blocking
Fix Template:
  // Remove any artificial delay before send_sms action for missed_call trigger
  // Ensure send_sms step does NOT await Twilio delivery confirmation (fire-and-forget)
  // Use Trigger.dev background task for delivery tracking, not blocking the main job
Verify: T5.3 re-run → job duration < 90s, SMS queued immediately
```

---

## UI / PORTAL FAILURES

### UI1 — Vantera Branding in Client Portal
```
Signature: T6.1 — "vantera" found in portal HTML/CSS/title
Root Cause: Brand injection not applied, or hardcoded fallback using Vantera name
Fix Template:
  // In portal shell layout (e.g. app/portal/layout.tsx):
  const account = await getAccountByDomain(request.headers.host)
  // Replace any hardcoded "Vantera" with:
  <title>{account.name}</title>
  <meta name="application-name" content={account.name} />
  // Check: CSS class names (acceptable), but text content and meta = not OK
  // Audit: grep -r "Vantera" src/app/portal/ -- fix any hits
Verify: T6.1 re-run → "vantera" not found in response body
```

### UI2 — Portal Accessible Without Auth
```
Signature: T6.2 — /dashboard returns 200 without JWT
Root Cause: Auth middleware not applied to portal routes
Fix Template (Next.js middleware):
  // In middleware.ts:
  export const config = { matcher: ['/portal/:path*'] }
  export function middleware(request: NextRequest) {
    const token = request.cookies.get('portal_session')
    if (!token) return NextResponse.redirect(new URL('/portal/login', request.url))
  }
Verify: T6.2 re-run → 302 redirect to login
```

---

## AUTOMATION AUDIT TRAIL FAILURES

### AT1 — automation_runs Missing Entry
```
Signature: T7.2 — automation fired (message sent) but no automation_runs row
Root Cause: Automation execution not wrapping action in audit log
Fix Template:
  // In automation engine, wrap every action execution:
  const runId = crypto.randomUUID()
  await supabase.from('automation_runs').insert({
    id: runId,
    automation_id: automation.id,
    trigger_event: event.name,
    trigger_payload: event.payload,
    action_type: action.type,
    status: 'executing',
    executed_at: new Date(),
  })
  try {
    const result = await executeAction(action, event)
    await supabase.from('automation_runs').update({ status: 'success', result_payload: result }).eq('id', runId)
  } catch (err) {
    await supabase.from('automation_runs').update({ status: 'failed', result_payload: { error: err.message } }).eq('id', runId)
    throw err
  }
Verify: T7.2 re-run → all automation actions have automation_runs entries
```

### AT2 — Feature Flag Not Blocking AI Send
```
Signature: T7.3 — Team plan account receives autonomous AI message
Root Cause: Feature flag check missing from generate_ai_message action handler
Fix Template:
  // In automation engine, before executing generate_ai_message action:
  const flags = await getFeatureFlags(account_id)
  if (action.type === 'generate_ai_message' && !flags.autonomous_ai_messaging) {
    // Queue for human review instead of auto-send
    await createPendingAIMessageForReview(action, context)
    return { status: 'pending_review' }
  }
Verify: T7.3 re-run → Team account message goes to review queue, not delivered
```

/**
 * Structured optimization-audit findings — the source data for the internal
 * optimization dashboard at /admin/optimization. Mirrors
 * docs/optimization-audit-2026-06-10.md so the in-app view stays in sync.
 *
 * To act on a finding, reference it by `id` (e.g. "implement SEC-001").
 */

export type FindingCategory = 'security' | 'ux' | 'ab'
export type FindingSeverity = 'high' | 'medium' | 'low' | 'info' | 'opportunity'
export type FindingStatus = 'open' | 'in_progress' | 'done'

export type OptimizationFinding = {
  id: string
  category: FindingCategory
  title: string
  severity: FindingSeverity
  status: FindingStatus
  location: string
  summary: string
  recommendation: string
}

export const AUDIT_DATE = '2026-06-10'
export const AUDIT_DOC_PATH = 'docs/optimization-audit-2026-06-10.md'

export const OPTIMIZATION_FINDINGS: OptimizationFinding[] = [
  // ── Security ──
  {
    id: 'SEC-001',
    category: 'security',
    title: 'Reply webhook has no authentication (reply injection)',
    severity: 'high',
    status: 'open',
    location: 'app/api/webhooks/sdr/reply/route.ts',
    summary:
      'POST calls handleSdrReply with no signature/secret/token check, is exempt from rate limiting, and swallows errors returning success:true. Anyone can forge replies for any stepId — polluting reply metrics and halting follow-ups.',
    recommendation:
      'Require an HMAC signature over the raw body (like the Unipile/Stripe handlers); reject mismatches with 401; stop returning success on internal failure.',
  },
  {
    id: 'SEC-002',
    category: 'security',
    title: 'Unipile webhook fails open + non-constant-time compare',
    severity: 'medium',
    status: 'open',
    location: 'app/api/webhooks/unipile/route.ts',
    summary:
      'verifySignature returns !secret — if UNIPILE_WEBHOOK_SECRET is unset, every request is accepted. Comparison uses === (timing-leaky).',
    recommendation:
      'Fail closed when the secret is missing in production; use crypto.timingSafeEqual on equal-length buffers.',
  },
  {
    id: 'SEC-003',
    category: 'security',
    title: 'Rate limiter fails open when Upstash unconfigured',
    severity: 'medium',
    status: 'open',
    location: 'lib/security/rate-limit.ts',
    summary:
      'applyRateLimit returns success:true when UPSTASH_REDIS_REST_* envs are missing. A missing/typo prod env silently disables all throttling (brute-force, enumeration).',
    recommendation:
      'In production, treat missing limiter config as a hard startup/health failure, or fail-closed on auth paths.',
  },
  {
    id: 'SEC-004',
    category: 'security',
    title: 'Webhooks bypass rate limiting',
    severity: 'low',
    status: 'open',
    location: 'lib/security/rate-limit.ts (shouldBypassRateLimit)',
    summary:
      'Acceptable only once every webhook verifies a signature. Combined with SEC-001 the reply webhook is unauthenticated AND unthrottled.',
    recommendation: 'Re-evaluate after SEC-001/002 land.',
  },
  {
    id: 'SEC-005',
    category: 'security',
    title: 'Long-lived session, no rotation on privilege change',
    severity: 'low',
    status: 'open',
    location: 'lib/auth/constants.ts, lib/auth/jwt.ts',
    summary:
      '7-day non-rotating JWT. API/actions re-bind to the live users row (good), but page loads trust the token until expiry.',
    recommendation:
      'Consider shorter access token + refresh, or a server-side session version to force-invalidate on role/deactivation changes.',
  },
  {
    id: 'SEC-006',
    category: 'security',
    title: 'Confirmed-good baseline (no action)',
    severity: 'info',
    status: 'done',
    location: 'middleware.ts, app/api/leads/route.ts, webhooks/stripe + resend',
    summary:
      'Tenant isolation scoped to session.accountId; admin JWT authoritative on /admin/*; Stripe + Resend signatures verified; RBAC rank gate; httpOnly+secure+sameSite cookies.',
    recommendation: 'Keep these patterns.',
  },

  // ── UX / Onboarding / Aha ──
  {
    id: 'UX-001',
    category: 'ux',
    title: 'Dead link /admin/agents (404) on the primary aha path',
    severity: 'high',
    status: 'open',
    location: 'WelcomePanel.tsx:75, CleanSlateWelcome.tsx:45',
    summary:
      "The dashboard's blue agent card and the clean-slate 'Configure agents' CTA both link to /admin/agents, which does not exist. A new user's most prominent first click 404s.",
    recommendation: 'Point both to /admin/outreach/agents (or add a redirect alias).',
  },
  {
    id: 'UX-002',
    category: 'ux',
    title: 'Paywall sits before the aha moment',
    severity: 'high',
    status: 'open',
    location: 'OnboardingWizard.tsx (STEP_IDS)',
    summary:
      'Subscription is step 4 of 6 — the user hits the credit-card step having only seen a lead preview, not acted on real value. Payment friction before activation depresses completion.',
    recommendation:
      'Move subscription after first real value, or make lead_preview an interactive aha (enroll a lead) before asking. See AB-001.',
  },
  {
    id: 'UX-003',
    category: 'ux',
    title: 'Two conflicting "first actions" for new users',
    severity: 'medium',
    status: 'open',
    location: 'CleanSlateWelcome.tsx vs dashboard empty states',
    summary:
      "Clean-slate pushes 'Find prospects' (manual Aspire search) while dashboard panels push 'Launch agent / Set up Scouting Agent' (autonomous). The product tells a new user two different first things.",
    recommendation:
      'Pick one canonical aha path (recommended: autonomous agent setup) and make the other secondary. See AB-003.',
  },
  {
    id: 'UX-004',
    category: 'ux',
    title: 'Onboarding progress is device-local only',
    severity: 'medium',
    status: 'open',
    location: 'OnboardingWizard.tsx (localStorage)',
    summary:
      'Step + AI analysis + preview leads persist only to localStorage. Switching device/browser mid-onboarding loses the expensive AI analysis and lead preview.',
    recommendation: 'Persist analysis/leads server-side on the account; keep localStorage as a cache.',
  },
  {
    id: 'UX-005',
    category: 'ux',
    title: 'Weak password policy + no strength feedback',
    severity: 'medium',
    status: 'open',
    location: 'lib/auth/actions.ts (signupSchema), components/auth/password-field.tsx',
    summary:
      'min(8) + one digit, no upper limit, no breach/common-password check, no strength meter. Weak credentials (security) and no guidance (UX).',
    recommendation: 'Add a strength meter, raise guidance (length-first 10–12+), optional HIBP k-anonymity check.',
  },
  {
    id: 'UX-006',
    category: 'ux',
    title: 'Brand-new dashboard reads as "broken" (0% / — gauges)',
    severity: 'low',
    status: 'open',
    location: 'MetricGaugesPanel.tsx, RevenueTrendCard.tsx, LeadsByStageCard.tsx',
    summary: 'Fresh accounts see 0%/—/empty gauges that look like failure, not "not started yet."',
    recommendation: 'First-run treatment: encouraging "run your first Scout" state or labeled example data.',
  },
  {
    id: 'UX-007',
    category: 'ux',
    title: '"Integrations" occupies a primary nav slot over core-loop pages',
    severity: 'low',
    status: 'open',
    location: 'lib/navigation/admin-nav.ts',
    summary:
      'Matches Figma literally, but Integrations is a config surface; Pipeline + Inbox (higher daily frequency) were demoted to the Workspace group.',
    recommendation: 'Consider swapping Integrations ↔ Pipeline in the primary group.',
  },
  {
    id: 'UX-008',
    category: 'ux',
    title: 'Agents nav adds an extra redirect hop',
    severity: 'low',
    status: 'open',
    location: 'lib/navigation/admin-nav.ts, app/(admin)/admin/sdr-agents/page.tsx',
    summary: "Nav item 'agent' href is /admin/sdr-agents, a server redirect to /admin/outreach/agents.",
    recommendation: 'Point the nav item directly at /admin/outreach/agents; keep the alias for bookmarks.',
  },
  {
    id: 'UX-009',
    category: 'ux',
    title: '"Calling Agent" is a dead-end tease',
    severity: 'low',
    status: 'open',
    location: 'AgentsHubView.tsx (CallingAgentCard)',
    summary: 'Shows "Soon" with no action and no backend.',
    recommendation: 'Add a "Notify me" capture, or hide behind a flag until the feature exists.',
  },

  {
    id: 'UX-010',
    category: 'ux',
    title: 'New accounts skipped onboarding and landed on the dashboard (FIXED)',
    severity: 'high',
    status: 'done',
    location: 'app/(admin)/layout.tsx, app/(admin)/admin/dashboard/page.tsx',
    summary:
      'The admin layout + dashboard gate decided onboarding completion from the middleware branding header (defaulting to true), which carries a host/tenant-resolved signal that could be stale or cross-tenant — so brand-new owners skipped the wizard and landed straight on the dashboard (every account showed onboarded=null yet reached a dashboard). Activation-blocking.',
    recommendation:
      'Fixed (commit 5ab0aa2): both gates now read onboarding_completed_at directly from the session account via isOnboardingCompleteForAccount; owners stay locked to /admin/onboarding until onboarding actually completes.',
  },

  // ── A/B experiments ──
  {
    id: 'AB-001',
    category: 'ab',
    title: 'Paywall placement in onboarding',
    severity: 'opportunity',
    status: 'open',
    location: 'OnboardingWizard.tsx',
    summary:
      'A = pay at step 4 (current) · B = dashboard access first, gate advanced volume later. Primary: onboarding completion → 7-day activation. Guardrail: trial→paid.',
    recommendation: 'Run behind the feature-flag system. Ties to UX-002.',
  },
  {
    id: 'AB-002',
    category: 'ab',
    title: 'Welcome panel: update chips vs single next-best-action',
    severity: 'opportunity',
    status: 'open',
    location: 'WelcomePanel.tsx',
    summary:
      'A = live-update chips (current) · B = single contextual NBA button. Primary: dashboard → meaningful action CTR. Guardrail: bounce/idle.',
    recommendation: 'Run behind the feature-flag system.',
  },
  {
    id: 'AB-003',
    category: 'ab',
    title: 'First-action framing: manual search vs autonomous agent',
    severity: 'opportunity',
    status: 'open',
    location: 'CleanSlateWelcome.tsx, dashboard empty states',
    summary:
      'A = Aspire-first · B = agent-setup-first. Primary: time-to-first-lead, D1 activation. Guardrail: setup abandonment.',
    recommendation: 'Run behind the feature-flag system. Ties to UX-003.',
  },
  {
    id: 'AB-004',
    category: 'ab',
    title: 'Signup layout: OAuth-first vs email-first',
    severity: 'opportunity',
    status: 'open',
    location: 'components/auth/auth-credentials-panel.tsx, oauth-buttons.tsx',
    summary:
      'A = current order · B = OAuth buttons primary, email collapsed. Primary: signup start → completion. Guardrail: downstream activation parity.',
    recommendation: 'Run behind the feature-flag system.',
  },
  {
    id: 'AB-005',
    category: 'ab',
    title: 'Agent card CTA copy',
    severity: 'opportunity',
    status: 'open',
    location: 'AgentsHubView.tsx (AgentCard)',
    summary: 'A = "Set Up" · B = time/value-framed ("Activate in ~2 min"). Primary: agent activation rate.',
    recommendation: 'Run behind the feature-flag system.',
  },
  {
    id: 'AB-006',
    category: 'ab',
    title: 'Revenue-goal step placement',
    severity: 'opportunity',
    status: 'open',
    location: 'OnboardingWizard.tsx',
    summary:
      'A = end / peak-end (current) · B = right after lead preview. Primary: goal-set completion + 30-day retention.',
    recommendation: 'Run behind the feature-flag system.',
  },
]

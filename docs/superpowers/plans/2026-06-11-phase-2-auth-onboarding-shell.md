# Phase 2 — Auth, Onboarding & App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user can sign up, confirm email, complete the 3-step onboarding wizard, and land on a real dashboard shell with working settings (incl. GDPR deletion request flow) — per `docs/superpowers/specs/2026-06-11-phase-2-auth-onboarding-shell-design.md`.

**Architecture:** Next.js 16 Server Actions + route-group guards. A pure `resolveGate` function is the single source of truth for redirects; server layouts call it. All mutations go through server actions using the existing `@supabase/ssr` server client (rule 02: accountId from session, never from input). New `packages/help-content` package (rule 09) and a `process-account-deletion` Trigger.dev task (rule 11).

**Tech Stack:** Next.js 16 (App Router, proxy.ts), React 19 (`useActionState`), Supabase Auth via `@supabase/ssr`, Tailwind 4 + existing shadcn-style primitives, Vitest, Trigger.dev v4.

**Executor notes:**
- `apps/web/AGENTS.md` warning applies: Next 16 has breaking changes — consult `node_modules/next/dist/docs/` if an API surprises you. `proxy.ts` already replaces middleware; `cookies()` is async.
- Schema already exists (migrations 0000–0006, applied to the dev Supabase project). **No new migrations in this phase.**
- Column-level grants: `authenticated` may update only `name, onboarding_industry, onboarding_icp, revenue_goal_cents, onboarding_completed_at` on `accounts`. Don't try to update anything else client-side.
- Commit after each task. Work on `main` (owner's workflow).

**Manual config (owner, Supabase dashboard — once, not code):** set the Auth email templates to point at the confirm route: Confirm signup → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`; Reset password → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`. Set Site URL to `http://localhost:3000` for dev.

---

## File map

| File | Responsibility |
|---|---|
| `apps/web/vitest.config.ts`, `package.json` | Vitest harness for web (node env, `@` alias) |
| `apps/web/src/lib/auth/gate.ts` (+test) | Pure gate-chain resolver |
| `apps/web/src/lib/auth/errors.ts` (+test) | Supabase auth error → friendly message |
| `apps/web/src/lib/validation.ts` (+test) | Onboarding/settings field validation, dollars→cents |
| `apps/web/src/lib/auth/context.ts` | `getGateContext()` — session user + account row (logic-free supabase reads) |
| `apps/web/src/lib/site-url.ts` | Site URL for email redirects |
| `apps/web/src/components/ui/input.tsx`, `label.tsx` | Form primitives (shadcn-style) |
| `apps/web/src/components/form-error.tsx` | Inline error text |
| `apps/web/src/app/(auth)/layout.tsx` | Centered-card auth shell |
| `apps/web/src/app/(auth)/actions.ts` | login / signup / requestPasswordReset / resetPassword actions |
| `apps/web/src/app/(auth)/{login,signup,forgot-password,reset-password}/page.tsx` | Auth pages (client forms via `useActionState`) |
| `apps/web/src/app/auth/confirm/route.ts` | `verifyOtp` token handler |
| `apps/web/src/app/onboarding/{layout.tsx,page.tsx,actions.ts,wizard.tsx}` | Hard-gated 3-step wizard |
| `apps/web/src/app/(app)/layout.tsx` | App gate + sidebar shell + user menu |
| `apps/web/src/app/(app)/actions.ts` | signOut |
| `apps/web/src/app/(app)/dashboard/page.tsx` | Goal card, activation checklist, agent status |
| `apps/web/src/app/(app)/{leads,campaigns,analytics}/page.tsx` + `src/components/coming-soon.tsx` | Designed coming-soon states |
| `apps/web/src/app/(app)/settings/{page.tsx,actions.ts,profile-form.tsx,workspace-form.tsx,danger-zone.tsx}` | Settings + deletion flow |
| `apps/web/src/app/page.tsx` | Landing page links |
| `packages/help-content/*` | Knowledge pack: frontmatter loader + 4 articles |
| `packages/jobs/src/lib/deletion.ts` (+test), `src/trigger/process-account-deletion.ts` | 7-day grace logic + deletion task |
| `.env.example` | `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` entries |

---

### Task 1: Vitest harness for `apps/web`

**Files:** Modify `apps/web/package.json`; Create `apps/web/vitest.config.ts`

- [ ] **Step 1:** Add to `apps/web/package.json` scripts: `"test": "vitest run"`; devDependencies: `"vitest": "^4.0.0"`. Run `pnpm install`.
- [ ] **Step 2:** Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3:** Verify: `pnpm --filter @vantera/web test` → "No test files found" is fine at this point only if exit code 0; otherwise add `passWithNoTests: true` to the config and remove it in Task 2.
- [ ] **Step 4:** Commit: `git commit -m "Add vitest harness to web app"`

### Task 2: Gate-chain resolver (TDD)

**Files:** Create `apps/web/src/lib/auth/gate.test.ts`, `apps/web/src/lib/auth/gate.ts`

- [ ] **Step 1:** Write failing tests:

```ts
import { describe, expect, it } from "vitest";
import { resolveGate, type GateContext } from "./gate";

const ctx = (over: Partial<GateContext>): GateContext => ({
  isAuthenticated: false, hasAccount: false, onboardingComplete: false, ...over,
});

describe("resolveGate", () => {
  it("auth pages redirect signed-in users to the dashboard", () => {
    expect(resolveGate("auth", ctx({ isAuthenticated: true }))).toBe("/dashboard");
  });
  it("auth pages render for anonymous users", () => {
    expect(resolveGate("auth", ctx({}))).toBeNull();
  });
  it("onboarding requires sign-in", () => {
    expect(resolveGate("onboarding", ctx({}))).toBe("/login");
  });
  it("onboarding renders for signed-in users without an account", () => {
    expect(resolveGate("onboarding", ctx({ isAuthenticated: true }))).toBeNull();
  });
  it("onboarding redirects to dashboard once complete", () => {
    expect(resolveGate("onboarding", ctx({ isAuthenticated: true, hasAccount: true, onboardingComplete: true }))).toBe("/dashboard");
  });
  it("app requires sign-in", () => {
    expect(resolveGate("app", ctx({}))).toBe("/login");
  });
  it("app hard-gates incomplete onboarding", () => {
    expect(resolveGate("app", ctx({ isAuthenticated: true }))).toBe("/onboarding");
    expect(resolveGate("app", ctx({ isAuthenticated: true, hasAccount: true }))).toBe("/onboarding");
  });
  it("app renders when the chain is satisfied", () => {
    expect(resolveGate("app", ctx({ isAuthenticated: true, hasAccount: true, onboardingComplete: true }))).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `pnpm --filter @vantera/web test` → FAIL (module not found).
- [ ] **Step 3:** Implement:

```ts
export type GateArea = "auth" | "onboarding" | "app";

export type GateContext = {
  isAuthenticated: boolean;
  hasAccount: boolean;
  onboardingComplete: boolean;
};

/** Single source of truth for the signup → onboarding → dashboard chain (spec: hard gate). */
export function resolveGate(area: GateArea, ctx: GateContext): string | null {
  switch (area) {
    case "auth":
      return ctx.isAuthenticated ? "/dashboard" : null;
    case "onboarding":
      if (!ctx.isAuthenticated) return "/login";
      return ctx.onboardingComplete ? "/dashboard" : null;
    case "app":
      if (!ctx.isAuthenticated) return "/login";
      if (!ctx.hasAccount || !ctx.onboardingComplete) return "/onboarding";
      return null;
  }
}
```

- [ ] **Step 4:** Run tests → PASS. Commit: `git commit -m "Gate-chain resolver with hard onboarding gate"`

### Task 3: Validation + friendly auth errors (TDD)

**Files:** Create `apps/web/src/lib/validation.test.ts`, `validation.ts`, `apps/web/src/lib/auth/errors.test.ts`, `errors.ts`

- [ ] **Step 1:** Failing tests `validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dollarsToCents, validateOnboarding, validateSignup } from "./validation";

describe("dollarsToCents", () => {
  it("parses plain and formatted dollars", () => {
    expect(dollarsToCents("5000")).toBe(500_000);
    expect(dollarsToCents("12,500.50")).toBe(1_250_050);
  });
  it("rejects non-positive and junk input", () => {
    expect(dollarsToCents("0")).toBeNull();
    expect(dollarsToCents("-10")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("")).toBeNull();
  });
});

describe("validateOnboarding", () => {
  const good = { industry: "SaaS", icp: "Mid-market CTOs", revenueGoal: "25000" };
  it("accepts complete answers", () => {
    expect(validateOnboarding(good)).toEqual({
      ok: true,
      values: { industry: "SaaS", icp: "Mid-market CTOs", revenueGoalCents: 2_500_000 },
    });
  });
  it.each([
    [{ ...good, industry: "  " }, "industry"],
    [{ ...good, icp: "" }, "ICP"],
    [{ ...good, revenueGoal: "0" }, "revenue goal"],
  ])("rejects %j", (input, field) => {
    const result = validateOnboarding(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(field.toLowerCase());
  });
});

describe("validateSignup", () => {
  it("requires email, 8+ char password, company name", () => {
    expect(validateSignup({ email: "a@b.co", password: "longenough", companyName: "Acme" }).ok).toBe(true);
    expect(validateSignup({ email: "", password: "longenough", companyName: "Acme" }).ok).toBe(false);
    expect(validateSignup({ email: "a@b.co", password: "short", companyName: "Acme" }).ok).toBe(false);
    expect(validateSignup({ email: "a@b.co", password: "longenough", companyName: " " }).ok).toBe(false);
  });
});
```

- [ ] **Step 2:** Failing tests `auth/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./errors";

describe("friendlyAuthError", () => {
  it("maps known Supabase auth errors", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("Incorrect email or password.");
    expect(friendlyAuthError("Email not confirmed")).toBe("Confirm your email first — check your inbox for the link.");
    expect(friendlyAuthError("User already registered")).toBe("An account with this email already exists. Try signing in.");
  });
  it("falls back to a generic message", () => {
    expect(friendlyAuthError("weird internal thing")).toBe("Something went wrong. Please try again.");
  });
});
```

- [ ] **Step 3:** Run → FAIL. Implement `validation.ts`:

```ts
export type Valid<T> = { ok: true; values: T };
export type Invalid = { ok: false; error: string };

export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export function validateOnboarding(input: { industry: string; icp: string; revenueGoal: string }):
  Valid<{ industry: string; icp: string; revenueGoalCents: number }> | Invalid {
  const industry = input.industry.trim();
  const icp = input.icp.trim();
  if (!industry) return { ok: false, error: "Enter your industry." };
  if (!icp) return { ok: false, error: "Describe your ICP (ideal customer profile)." };
  const revenueGoalCents = dollarsToCents(input.revenueGoal);
  if (revenueGoalCents === null) return { ok: false, error: "Enter a monthly revenue goal greater than zero." };
  return { ok: true, values: { industry, icp, revenueGoalCents } };
}

export function validateSignup(input: { email: string; password: string; companyName: string }):
  Valid<{ email: string; password: string; companyName: string }> | Invalid {
  const email = input.email.trim();
  const companyName = input.companyName.trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!companyName) return { ok: false, error: "Enter your company name." };
  return { ok: true, values: { email, password: input.password, companyName } };
}
```

`auth/errors.ts`:

```ts
const KNOWN: Record<string, string> = {
  "Invalid login credentials": "Incorrect email or password.",
  "Email not confirmed": "Confirm your email first — check your inbox for the link.",
  "User already registered": "An account with this email already exists. Try signing in.",
};

export function friendlyAuthError(message: string): string {
  return KNOWN[message] ?? "Something went wrong. Please try again.";
}
```

- [ ] **Step 4:** Run → PASS. Commit: `git commit -m "Validation helpers and friendly auth errors"`

### Task 4: Gate context helper + site URL

**Files:** Create `apps/web/src/lib/auth/context.ts`, `apps/web/src/lib/site-url.ts`; Modify `.env.example`

Logic-free supabase reads — covered by gate tests + build, no unit test.

- [ ] **Step 1:** `context.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type AccountRow = {
  id: string;
  name: string;
  onboarding_industry: string | null;
  onboarding_icp: string | null;
  revenue_goal_cents: number | null;
  onboarding_completed_at: string | null;
};

export type GateData = {
  user: { id: string; email: string | null; companyName: string | null; displayName: string | null } | null;
  account: AccountRow | null;
};

/** Session-derived identity + first account (RLS scopes the query). Rule 02: never trust client account ids. */
export async function getGateData(): Promise<GateData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, account: null };

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, onboarding_industry, onboarding_icp, revenue_goal_cents, onboarding_completed_at")
    .limit(1)
    .maybeSingle<AccountRow>();

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      companyName: (user.user_metadata?.company_name as string | undefined) ?? null,
      displayName: null,
    },
    account: account ?? null,
  };
}

export function toGateContext(data: GateData) {
  return {
    isAuthenticated: data.user !== null,
    hasAccount: data.account !== null,
    onboardingComplete: data.account?.onboarding_completed_at != null,
  };
}
```

- [ ] **Step 2:** `site-url.ts`:

```ts
/** Base URL for auth email redirects. Set NEXT_PUBLIC_SITE_URL per environment (rule 10). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
```

- [ ] **Step 3:** Append to `.env.example` (web section): `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- [ ] **Step 4:** `pnpm --filter @vantera/web type-check` → PASS. Commit: `git commit -m "Gate data helper and site URL config"`

### Task 5: Form primitives

**Files:** Create `apps/web/src/components/ui/input.tsx`, `ui/label.tsx`, `apps/web/src/components/form-error.tsx`

Presentational only — verified by type-check/build and usage in later tasks.

- [ ] **Step 1:** `input.tsx` (match existing shadcn idiom — cn + data-slot):

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
```

- [ ] **Step 2:** `label.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-sm font-medium leading-none select-none", className)}
      {...props}
    />
  );
}

export { Label };
```

- [ ] **Step 3:** `form-error.tsx`:

```tsx
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
```

- [ ] **Step 4:** Type-check → PASS. Commit: `git commit -m "Input, label, and form-error primitives"`

### Task 6: Auth actions + pages + confirm route

**Files:** Create `apps/web/src/app/(auth)/layout.tsx`, `(auth)/actions.ts`, `(auth)/login/page.tsx`, `(auth)/signup/page.tsx`, `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx`, `apps/web/src/app/auth/confirm/route.ts`

- [ ] **Step 1:** `(auth)/layout.tsx` — centered card; per-page gating happens in pages (reset-password runs inside a recovery session, so the layout itself must not redirect signed-in users):

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <a href="/" className="text-2xl font-semibold tracking-tight">Vantera</a>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2:** `(auth)/actions.ts` — all four actions return `{ error?: string; sent?: boolean }` for `useActionState`; success paths `redirect()`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyAuthError } from "@/lib/auth/errors";
import { validateSignup } from "@/lib/validation";
import { siteUrl } from "@/lib/site-url";

export type AuthFormState = { error?: string; sent?: boolean };

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/dashboard"); // app gate forwards to /onboarding if incomplete
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = validateSignup({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: result.values.email,
    password: result.values.password,
    options: {
      data: { company_name: result.values.companyName },
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/onboarding`,
    },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return { sent: true };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // always claim success: don't leak which emails exist
  return { sent: true };
}

export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/dashboard");
}
```

- [ ] **Step 3:** `auth/confirm/route.ts`:

```ts
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  }
  redirect("/login?error=link-expired");
}
```

- [ ] **Step 4:** Pages. Each is a client form bound with `useActionState`, server-gated via a tiny server wrapper. Pattern (login shown in full; signup/forgot/reset follow it):

`(auth)/login/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest) redirect(dest);
  const { error } = await searchParams;
  return <LoginForm linkExpired={error === "link-expired"} />;
}
```

`(auth)/login/login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login, type AuthFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

export function LoginForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          {linkExpired && <FormError message="That link expired or was already used. Sign in or request a new one." />}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <FormError message={state.error} />
          <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
          <div className="flex justify-between text-sm text-muted-foreground">
            <a className="hover:underline" href="/forgot-password">Forgot password?</a>
            <a className="hover:underline" href="/signup">Create account</a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

Variants:
- **signup/page.tsx + signup-form.tsx** — fields: Company name (`companyName`, autoComplete="organization"), Email, Password (autoComplete="new-password"). When `state.sent`, replace the form with a "Check your email" card: "We sent a confirmation link to your inbox. Click it to continue." Link back to `/login`.
- **forgot-password** — single email field; on `state.sent` show "If an account exists for that email, a reset link is on its way."
- **reset-password** — single new-password field calling `resetPassword`; page does **not** call `resolveGate("auth", …)` (recovery session is signed-in); if `getGateData()` returns no user, redirect to `/login?error=link-expired`.

- [ ] **Step 5:** `pnpm --filter @vantera/web type-check && pnpm --filter @vantera/web lint` → PASS. Commit: `git commit -m "Auth pages: signup, login, password reset, email confirm"`

### Task 7: Onboarding wizard (hard gate)

**Files:** Create `apps/web/src/app/onboarding/layout.tsx`, `onboarding/page.tsx`, `onboarding/actions.ts`, `onboarding/wizard.tsx`

- [ ] **Step 1:** `onboarding/layout.tsx` — enforce gate:

```tsx
import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const dest = resolveGate("onboarding", toGateContext(await getGateData()));
  if (dest) redirect(dest);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2:** `onboarding/actions.ts` — creates the account on first completion (company name from signup metadata; fallback = email prefix), then writes onboarding answers. Only grant-listed columns are touched:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateOnboarding } from "@/lib/validation";

export type OnboardingState = { error?: string };

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const result = validateOnboarding({
    industry: String(formData.get("industry") ?? ""),
    icp: String(formData.get("icp") ?? ""),
    revenueGoal: String(formData.get("revenueGoal") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) {
    const name =
      (user.user_metadata?.company_name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "My workspace";
    const { data: accountId, error: rpcError } = await supabase.rpc("create_account", { account_name: name });
    if (rpcError || !accountId) return { error: "Could not create your workspace. Please try again." };
    account = { id: accountId as string };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      onboarding_industry: result.values.industry,
      onboarding_icp: result.values.icp,
      revenue_goal_cents: result.values.revenueGoalCents,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  if (error) return { error: "Could not save your answers. Please try again." };

  redirect("/dashboard");
}
```

- [ ] **Step 3:** `onboarding/page.tsx` renders `<Wizard email={user.email} />`; `onboarding/wizard.tsx` is the client component. Retention brief: 3 steps, one field per step, endowed progress (step 0 "Account created" pre-checked). Structure:

```tsx
"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

const STEPS = [
  { key: "industry", title: "What industry are you in?", placeholder: "e.g. B2B SaaS, logistics, fintech", hint: "Your SDR agent tailors prospecting to your space." },
  { key: "icp", title: "Who is your ideal customer?", placeholder: "e.g. VP of Operations at mid-market logistics companies", hint: "This becomes your default campaign targeting." },
  { key: "revenueGoal", title: "What's your monthly revenue goal?", placeholder: "e.g. 25,000", hint: "We track every campaign against this goal." },
] as const;

export function Wizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ industry: "", icp: "", revenueGoal: "" });
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});

  // progress: 1 endowed segment (account created) + 3 wizard steps
  const segmentsDone = 1 + step;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex gap-1.5" aria-label={`Step ${segmentsDone} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < segmentsDone ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Account created ✓ — {STEPS.length - step} step{STEPS.length - step === 1 ? "" : "s"} to your dashboard</p>
        <CardTitle>{current.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          onSubmit={(e) => {
            if (!isLast) {
              e.preventDefault();
              if (values[current.key].trim()) setStep(step + 1);
            }
          }}
          className="flex flex-col gap-4"
        >
          {/* all three values always submit; only the current one is visible */}
          {STEPS.map(({ key }) => (
            <input key={key} type="hidden" name={key} value={key === current.key ? undefined : values[key]} />
          ))}
          <div className="flex flex-col gap-2">
            <Label htmlFor={current.key}>{current.title}</Label>
            <Input
              id={current.key}
              name={current.key}
              value={values[current.key]}
              onChange={(e) => setValues({ ...values, [current.key]: e.target.value })}
              placeholder={current.placeholder}
              inputMode={current.key === "revenueGoal" ? "decimal" : "text"}
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">{current.hint}</p>
          </div>
          <FormError message={state.error} />
          <div className="flex justify-between">
            <Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            <Button type="submit" disabled={pending}>
              {isLast ? (pending ? "Finishing…" : "Finish setup") : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Executor note:** hidden inputs with `value={undefined}` are dropped by React — the visible input supplies the current step's value; guard against duplicate names by skipping the hidden input for `current.key` entirely (render `STEPS.filter(s => s.key !== current.key)`). Fix this when implementing; the test for the action covers the server side.

- [ ] **Step 4:** Type-check + lint → PASS. Commit: `git commit -m "Onboarding wizard: 3-step capture with hard gate"`

### Task 8: App shell — layout, nav, sign-out, coming-soon pages

**Files:** Create `apps/web/src/app/(app)/layout.tsx`, `(app)/actions.ts`, `apps/web/src/components/coming-soon.tsx`, `(app)/leads/page.tsx`, `(app)/campaigns/page.tsx`, `(app)/analytics/page.tsx`

- [ ] **Step 1:** `(app)/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2:** `(app)/layout.tsx` — gate + sidebar (Lucide icons: LayoutDashboard, Users, Megaphone, BarChart3, Settings) + user menu footer with email + sign-out button (form action={signOut}):

```tsx
import { redirect } from "next/navigation";
import { LayoutDashboard, Users, Megaphone, BarChart3, Settings, LogOut } from "lucide-react";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { signOut } from "./actions";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await getGateData();
  const dest = resolveGate("app", toGateContext(data));
  if (dest) redirect(dest);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-border px-3 py-4">
        <a href="/dashboard" className="px-2 text-lg font-semibold tracking-tight">Vantera</a>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="border-t border-border pt-3">
          <p className="truncate px-2 text-xs text-muted-foreground">{data.user?.email}</p>
          <form action={signOut} className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
```

Also create `apps/web/src/components/nav-link.tsx` (client component using `usePathname` for the active state):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const active = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}
```

- [ ] **Step 3:** `components/coming-soon.tsx` — no dead ends (churn check): name what appears and what unlocks it:

```tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title, description, unlocks }: { title: string; description: string; unlocks: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <Card className="mt-6">
        <CardContent className="py-10 text-center">
          <p className="mx-auto max-w-md text-muted-foreground">{description}</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground/80">{unlocks}</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4:** Three pages using it (no vendor names — white-label):
  - Leads: title "Leads", description "Every prospect your SDR agent sources, scores, and enriches will appear here with its quality rationale.", unlocks "Unlocks when the lead pipeline goes live."
  - Campaigns: "Campaigns" / "Create outreach campaigns and let your SDR agent run them on schedule — email, LinkedIn, or both." / "Unlocks with the campaign wizard."
  - Analytics: "Analytics" / "Track sends, replies, meetings booked, and progress toward your revenue goal." / "Unlocks once campaigns are running."
- [ ] **Step 5:** Type-check + lint → PASS. Commit: `git commit -m "App shell: gated layout, sidebar nav, coming-soon surfaces"`

### Task 9: Dashboard home

**Files:** Create `apps/web/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1:** Server component reading `getGateData()` (layout already gated; account is non-null here). Three sections, all real data (retention brief: endowed progress + commitment):

```tsx
import { CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGateData } from "@/lib/auth/context";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function DashboardPage() {
  const { account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const goal = account.revenue_goal_cents ? usd.format(account.revenue_goal_cents / 100) : null;

  const checklist = [
    { label: "Create your account", done: true },
    { label: "Set your industry, ICP, and revenue goal", done: true },
    { label: "Launch your first campaign", done: false, note: "Coming soon" },
    { label: "Get your first reply", done: false, note: "After your first campaign" },
  ];
  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">
            Targeting <span className="font-medium">{account.onboarding_icp}</span> in{" "}
            <span className="font-medium">{account.onboarding_industry}</span>
            {goal && <> — goal <span className="font-medium">{goal}/mo</span></>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every campaign is measured against this. Edit it anytime in Settings.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting started — {doneCount}/{checklist.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  {item.done
                    ? <CheckCircle2 className="size-4 text-primary" />
                    : <Circle className="size-4 text-muted-foreground" />}
                  <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
                  {item.note && <Badge variant="secondary">{item.note}</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SDR Prospect Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />
              <span className="text-sm font-medium">Standing by</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your agent goes Live when your first campaign launches — it will prospect, score, and
              reach out to only high-quality leads matching your ICP.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Type-check + lint → PASS. Commit: `git commit -m "Dashboard home: goal card, activation checklist, agent status"`

### Task 10: Settings — profile, workspace, team, danger zone (TDD on actions' validation)

**Files:** Create `apps/web/src/app/(app)/settings/page.tsx`, `settings/actions.ts`, `settings/profile-form.tsx`, `settings/workspace-form.tsx`, `settings/danger-zone.tsx`; Create `apps/web/src/lib/validation.test.ts` additions + `validation.ts` additions

- [ ] **Step 1:** Failing tests — add to `validation.test.ts`:

```ts
import { confirmAccountName, validateWorkspace } from "./validation";

describe("validateWorkspace", () => {
  it("requires a name and accepts optional onboarding edits", () => {
    expect(validateWorkspace({ name: "Acme", industry: "SaaS", icp: "CTOs", revenueGoal: "1000" }).ok).toBe(true);
    expect(validateWorkspace({ name: " ", industry: "SaaS", icp: "CTOs", revenueGoal: "1000" }).ok).toBe(false);
    expect(validateWorkspace({ name: "Acme", industry: "SaaS", icp: "CTOs", revenueGoal: "junk" }).ok).toBe(false);
  });
});

describe("confirmAccountName", () => {
  it("requires an exact (trimmed) match", () => {
    expect(confirmAccountName("Acme Inc", " Acme Inc ")).toBe(true);
    expect(confirmAccountName("Acme Inc", "acme inc")).toBe(false);
    expect(confirmAccountName("Acme Inc", "")).toBe(false);
  });
});
```

- [ ] **Step 2:** Run → FAIL. Implement in `validation.ts`:

```ts
export function validateWorkspace(input: { name: string; industry: string; icp: string; revenueGoal: string }):
  Valid<{ name: string; industry: string; icp: string; revenueGoalCents: number }> | Invalid {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Workspace name can't be empty." };
  const onboarding = validateOnboarding(input);
  if (!onboarding.ok) return onboarding;
  return { ok: true, values: { name, ...onboarding.values } };
}

export function confirmAccountName(accountName: string, typed: string): boolean {
  return typed.trim() === accountName;
}
```

- [ ] **Step 3:** Run → PASS. Commit: `git commit -m "Workspace and deletion-confirm validation"`
- [ ] **Step 4:** `settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { confirmAccountName, validateWorkspace } from "@/lib/validation";

export type SettingsState = { error?: string; saved?: boolean };

export async function updateProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return { error: "Display name can't be empty." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, display_name: displayName });
  if (error) return { error: "Could not save your profile. Please try again." };
  revalidatePath("/settings");
  return { saved: true };
}

export async function updateWorkspace(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const result = validateWorkspace({
    name: String(formData.get("name") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    icp: String(formData.get("icp") ?? ""),
    revenueGoal: String(formData.get("revenueGoal") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };

  const { error } = await supabase
    .from("accounts")
    .update({
      name: result.values.name,
      onboarding_industry: result.values.industry,
      onboarding_icp: result.values.icp,
      revenue_goal_cents: result.values.revenueGoalCents,
    })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change these settings." };
  revalidatePath("/settings");
  return { saved: true };
}

export async function requestAccountDeletion(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const typed = String(formData.get("confirmName") ?? "");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase.from("accounts").select("id, name").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };
  if (!confirmAccountName(account.name, typed)) {
    return { error: "Type the workspace name exactly to confirm." };
  }

  const { error } = await supabase
    .from("account_deletion_requests")
    .insert({ account_id: account.id, requested_by: user.id });
  if (error) return { error: "Could not request deletion. Only workspace admins can do this." };
  revalidatePath("/settings");
  return { saved: true };
}

export async function cancelAccountDeletion(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const requestId = String(formData.get("requestId") ?? "");
  const supabase = await createClient();

  const { error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "canceled" })
    .eq("id", requestId)
    .eq("status", "pending"); // RLS scopes to the member's account; rule 02
  if (error) return { error: "Could not cancel the request." };
  revalidatePath("/settings");
  return { saved: true };
}
```

- [ ] **Step 5:** `settings/page.tsx` (server) loads: gate data, `user_profiles` row, members list (`account_members` join is not exposed — query `account_members` for user_ids + roles; display emails only for self, others as role rows), pending deletion request:

```tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { ProfileForm } from "./profile-form";
import { WorkspaceForm } from "./workspace-form";
import { DangerZone } from "./danger-zone";

export default async function SettingsPage() {
  const { user, account } = await getGateData();
  if (!user || !account) return null;

  const supabase = await createClient();
  const [{ data: profile }, { data: members }, { data: deletionRequest }] = await Promise.all([
    supabase.from("user_profiles").select("display_name").maybeSingle(),
    supabase.from("account_members").select("user_id, role").eq("account_id", account.id),
    supabase
      .from("account_deletion_requests")
      .select("id, created_at")
      .eq("account_id", account.id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <ProfileForm displayName={profile?.display_name ?? ""} email={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Workspace</CardTitle></CardHeader>
        <CardContent>
          <WorkspaceForm
            name={account.name}
            industry={account.onboarding_industry ?? ""}
            icp={account.onboarding_icp ?? ""}
            revenueGoalDollars={account.revenue_goal_cents ? String(account.revenue_goal_cents / 100) : ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between text-sm">
                <span>{m.user_id === user.id ? (user.email ?? "You") : "Team member"}</span>
                <Badge variant="secondary">{m.role}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Team invites are coming soon.</p>
        </CardContent>
      </Card>

      <DangerZone
        accountName={account.name}
        pendingRequest={deletionRequest ? { id: deletionRequest.id, createdAt: deletionRequest.created_at } : null}
      />
    </div>
  );
}
```

- [ ] **Step 6:** Client forms, same `useActionState` pattern as Task 6 (each shows `state.error` via FormError, "Saved" text when `state.saved`):
  - `profile-form.tsx` — read-only email display + `displayName` input → `updateProfile`.
  - `workspace-form.tsx` — `name`, `industry`, `icp`, `revenueGoal` inputs → `updateWorkspace`. Helper text: "Industry, ICP, and goal seed your default campaign targeting."
  - `danger-zone.tsx` — destructive-styled Card. If `pendingRequest`: warning banner "This workspace is scheduled for permanent deletion on {createdAt + 7 days, formatted}. All data will be erased." + Cancel button (form with hidden `requestId` → `cancelAccountDeletion`). Otherwise: explanation ("Deletes this workspace and all its data after a 7-day grace period. This cannot be undone after that."), `confirmName` input labeled "Type the workspace name to confirm", destructive Button → `requestAccountDeletion`.
- [ ] **Step 7:** Type-check + lint + test → PASS. Commit: `git commit -m "Settings: profile, workspace, team list, deletion request flow"`

### Task 11: Account-deletion job (TDD on grace logic)

**Files:** Modify `packages/jobs/package.json`; Create `packages/jobs/vitest.config.ts`, `packages/jobs/src/lib/deletion.ts`, `deletion.test.ts`, `packages/jobs/src/trigger/process-account-deletion.ts`; Modify `.env.example`

- [ ] **Step 1:** Add to `packages/jobs/package.json`: script `"test": "vitest run"`; devDep `"vitest": "^4.0.0"`; dep `"@supabase/supabase-js": "^2.108.1"`. `pnpm install`. Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 2:** Failing test `src/lib/deletion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GRACE_DAYS, isEligibleForDeletion } from "./deletion";

describe("isEligibleForDeletion", () => {
  const now = new Date("2026-06-11T00:00:00Z");
  it("is not eligible inside the grace window", () => {
    expect(isEligibleForDeletion(new Date("2026-06-05T00:00:00Z"), now)).toBe(false);
    expect(isEligibleForDeletion(now, now)).toBe(false);
  });
  it("is eligible once the grace window has passed", () => {
    expect(isEligibleForDeletion(new Date("2026-06-04T00:00:00Z"), now)).toBe(true);
    expect(isEligibleForDeletion(new Date("2026-05-01T00:00:00Z"), now)).toBe(true);
  });
  it("uses a 7-day grace window", () => {
    expect(GRACE_DAYS).toBe(7);
  });
});
```

- [ ] **Step 3:** Run `pnpm --filter @vantera/jobs test` → FAIL. Implement `src/lib/deletion.ts`:

```ts
export const GRACE_DAYS = 7;

/** Spec: deletion requests are processed only after the 7-day grace window (owner-confirmed). */
export function isEligibleForDeletion(requestedAt: Date, now: Date): boolean {
  const graceMs = GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - requestedAt.getTime() >= graceMs;
}
```

- [ ] **Step 4:** Run → PASS. Commit: `git commit -m "Deletion grace-window logic"`
- [ ] **Step 5:** `src/trigger/process-account-deletion.ts` — daily schedule; service-role client (bypasses RLS — rule 11 sanctioned path); vendor cleanup stubs logged until Phase 5 vendors exist:

```ts
import { logger, schedules } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { isEligibleForDeletion } from "../lib/deletion";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Rule 11 deletion path: vendor cleanup, then hard delete (FK cascades wipe all tenant data). */
export const processAccountDeletion = schedules.task({
  id: "process-account-deletion",
  cron: "0 3 * * *",
  run: async () => {
    const supabase = serviceClient();
    const now = new Date();

    const { data: requests, error } = await supabase
      .from("account_deletion_requests")
      .select("id, account_id, created_at")
      .eq("status", "pending");
    if (error) throw new Error(`failed to list deletion requests: ${error.message}`);

    let processed = 0;
    for (const request of requests ?? []) {
      if (!isEligibleForDeletion(new Date(request.created_at), now)) continue;

      await supabase
        .from("account_deletion_requests")
        .update({ status: "vendor_cleanup" })
        .eq("id", request.id);

      // Vendor deletion calls land here as each vendor integration ships (Phase 5+).
      logger.info("vendor cleanup (no vendors connected yet)", { accountId: request.account_id });

      const { error: deleteError } = await supabase
        .from("accounts")
        .delete()
        .eq("id", request.account_id);
      if (deleteError) {
        logger.error("account hard-delete failed", { accountId: request.account_id, error: deleteError.message });
        continue;
      }
      processed += 1;
      logger.info("account deleted", { accountId: request.account_id });
    }
    return { processed };
  },
});
```

- [ ] **Step 6:** Append to `.env.example` (jobs section): `SUPABASE_SERVICE_ROLE_KEY=` (with a comment: server-only, never NEXT_PUBLIC). Run `pnpm --filter @vantera/jobs type-check && pnpm --filter @vantera/jobs test` → PASS. Commit: `git commit -m "process-account-deletion job: 7-day grace, vendor stubs, hard delete"`

### Task 12: `packages/help-content` (TDD)

**Files:** Create `packages/help-content/package.json`, `tsconfig.json`, `src/index.ts`, `src/articles.test.ts`, `content/getting-started.md`, `content/dashboard-overview.md`, `content/account-settings.md`, `content/sign-in-help.md`

- [ ] **Step 1:** `package.json` (mirror email-infra):

```json
{
  "name": "@vantera/help-content",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "type-check": "tsc --noEmit", "test": "vitest run" },
  "devDependencies": { "typescript": "^5.8.0", "vitest": "^4.0.0" }
}
```

`tsconfig.json`: `{ "extends": "../../tsconfig.base.json", "include": ["src", "*.ts"] }`. `pnpm install`.

- [ ] **Step 2:** Failing tests `src/articles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { articlesForRoute, loadArticles, parseFrontmatter } from "./index";

describe("parseFrontmatter", () => {
  it("parses title, surface, and routes", () => {
    const raw = `---\ntitle: Test\nsurface: dashboard\nroutes: /dashboard, /settings\n---\n\nBody here.`;
    expect(parseFrontmatter(raw)).toEqual({
      title: "Test",
      surface: "dashboard",
      routes: ["/dashboard", "/settings"],
      body: "Body here.",
    });
  });
  it("throws on missing required fields", () => {
    expect(() => parseFrontmatter(`---\ntitle: X\n---\nbody`)).toThrow();
  });
});

describe("loadArticles", () => {
  it("loads every shipped article with complete frontmatter", () => {
    const articles = loadArticles();
    expect(articles.length).toBeGreaterThanOrEqual(4);
    for (const a of articles) {
      expect(a.title).toBeTruthy();
      expect(a.surface).toBeTruthy();
      expect(a.routes.length).toBeGreaterThan(0);
      expect(a.body).toBeTruthy();
    }
  });
  it("never leaks vendor names (white-label, rule 09)", () => {
    const banned = /smartlead|unipile|explorium|trigger\.dev|supabase/i;
    for (const a of loadArticles()) {
      expect(a.title + a.body).not.toMatch(banned);
    }
  });
});

describe("articlesForRoute", () => {
  it("returns articles registered for a route", () => {
    const titles = articlesForRoute("/settings").map((a) => a.title);
    expect(titles.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3:** Run `pnpm --filter @vantera/help-content test` → FAIL. Implement `src/index.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type HelpArticle = {
  slug: string;
  title: string;
  surface: string;
  routes: string[];
  body: string;
};

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

export function parseFrontmatter(raw: string): Omit<HelpArticle, "slug"> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("missing frontmatter block");
  const fields = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  const title = fields.get("title");
  const surface = fields.get("surface");
  const routes = fields.get("routes")?.split(",").map((r) => r.trim()).filter(Boolean);
  if (!title || !surface || !routes?.length) {
    throw new Error("frontmatter requires title, surface, and routes");
  }
  return { title, surface, routes, body: match[2].trim() };
}

export function loadArticles(): HelpArticle[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => ({
      slug: file.replace(/\.md$/, ""),
      ...parseFrontmatter(readFileSync(join(CONTENT_DIR, file), "utf8")),
    }));
}

export function articlesForRoute(route: string): HelpArticle[] {
  return loadArticles().filter((a) => a.routes.includes(route));
}
```

- [ ] **Step 4:** Write the four articles (white-label — describe behavior, never vendors). Full content for each:

`content/getting-started.md`:

```markdown
---
title: Getting started with Vantera
surface: onboarding
routes: /onboarding, /dashboard
---

# Getting started with Vantera

When you create your account, Vantera asks three questions:

1. **Your industry** — so your SDR agent prospects in the right space.
2. **Your ideal customer profile (ICP)** — who your agent should look for. This becomes the default targeting whenever you create a campaign.
3. **Your monthly revenue goal** — every campaign is tracked against this number.

You can change any of these later in **Settings → Workspace**.

After onboarding you land on your dashboard. Your SDR Prospect Agent shows as **Standing by** — it goes **Live** when you launch your first campaign.
```

`content/dashboard-overview.md`:

```markdown
---
title: Understanding your dashboard
surface: dashboard
routes: /dashboard
---

# Understanding your dashboard

- **Your goal** — the ICP, industry, and monthly revenue goal you set during onboarding. Everything Vantera does is measured against this. Edit it in Settings.
- **Getting started** — your setup checklist. Launching your first campaign and getting your first reply unlock as those features arrive.
- **SDR Prospect Agent** — your agent's status. *Standing by* means it's ready and waiting for a campaign; it flips to *Live* when one launches.

**Leads**, **Campaigns**, and **Analytics** in the sidebar show what's coming: sourced and scored leads, outreach campaigns your agent runs on schedule, and progress toward your revenue goal.
```

`content/account-settings.md`:

```markdown
---
title: Account settings and deleting your workspace
surface: settings
routes: /settings
---

# Account settings

- **Profile** — your display name, visible to your team.
- **Workspace** — workspace name plus the industry, ICP, and revenue goal that seed your default campaign targeting. Only workspace admins can change these.
- **Team** — who's in your workspace. Invites are coming soon.

## Deleting your workspace

In the danger zone, type your workspace name to confirm deletion. The workspace is then **scheduled for permanent deletion after a 7-day grace period** — during those 7 days an admin can cancel from the same screen. After the grace period, all workspace data is permanently erased, including data held by our processing partners.
```

`content/sign-in-help.md`:

```markdown
---
title: Signing in and resetting your password
surface: auth
routes: /login, /forgot-password
---

# Signing in

Sign in with the email and password you registered with. New accounts must confirm their email first — check your inbox for the confirmation link.

## Forgot your password?

Use **Forgot password** on the sign-in page. If an account exists for the email you enter, you'll receive a reset link. The link signs you in and asks for a new password.

## Link expired?

Confirmation and reset links are single-use and expire. Request a fresh one from the sign-in or forgot-password page.
```

- [ ] **Step 5:** Run tests → PASS (note: the vendor-name test bans "supabase" in article bodies — keep it that way). Commit: `git commit -m "help-content package: loader, frontmatter parser, first four articles"`

### Task 13: Landing page links

**Files:** Modify `apps/web/src/app/page.tsx`

- [ ] **Step 1:** Add CTAs under the existing copy:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Vantera</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Sales intelligence run by SDR agents — prospect, score, and outreach
        only high-quality leads.
      </p>
      <div className="mt-2 flex gap-3">
        <Button asChild><Link href="/signup">Get started</Link></Button>
        <Button asChild variant="outline"><Link href="/login">Sign in</Link></Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2:** Type-check + lint → PASS. Commit: `git commit -m "Landing page sign-in and signup links"`

### Task 14: Ship checks (rule 12 definition of done)

- [ ] **Step 1:** Full gate: `pnpm lint && pnpm type-check && pnpm test && pnpm build` → all green.
- [ ] **Step 2:** Manual smoke (requires dev Supabase env in `apps/web/.env.local`): `pnpm dev` → signup → confirm email (Supabase dashboard → Auth → user → confirm, or inbucket) → onboarding 3 steps → dashboard shows real answers → settings edits → deletion request + cancel → logout/login.
- [ ] **Step 3:** Dispatch `whitelabel-auditor` agent over the diff (user-facing surfaces shipped). Fix any findings.
- [ ] **Step 4:** Knowledge-sync check (rule 09): four articles ship in this PR — covered by Task 12. No new copilot tools yet (copilot ships Phase 6; articles are the Phase 2 obligation).
- [ ] **Step 5:** Flip the Phase 2 checkbox in `docs/roadmap.md` to `[x]` with "Shipped 2026-06-11" note.
- [ ] **Step 6:** Final commit: `git commit -m "Phase 2 complete: auth, onboarding, app shell"` (include roadmap flip).

---

## Self-review (done at write time)

- **Spec coverage:** auth pages ✓ (T6), confirm route ✓ (T6), hard gate ✓ (T2/T7/T8), create_account ✓ (T7), wizard ✓ (T7), dashboard home ✓ (T9), coming-soon surfaces ✓ (T8), settings + deletion + cancel ✓ (T10), deletion job ✓ (T11), help-content ✓ (T12), landing links ✓ (T13), DoD ✓ (T14). Team invites: schema only (exists) — read-only list shipped in T10.
- **Type consistency:** `AuthFormState`/`OnboardingState`/`SettingsState` shapes match across forms/actions; `getGateData`/`toGateContext`/`resolveGate` names consistent.
- **Known wrinkle flagged inline:** wizard hidden-input duplication (T7 executor note).

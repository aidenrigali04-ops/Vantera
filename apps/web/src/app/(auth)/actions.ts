"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { friendlyAuthError } from "@/lib/auth/errors";
import { validateSignup } from "@/lib/validation";
import { siteUrl } from "@/lib/site-url";
import { recordSecurityEvent } from "@/lib/security/audit";

export type AuthFormState = { error?: string; sent?: boolean };

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Security audit: failed logins are a credential-stuffing / brute-force signal. This is a
    // system event (no account_id resolved on failure), readable only by service role.
    const h = await headers();
    await recordSecurityEvent({
      eventType: "auth.login_failed",
      severity: "warn",
      ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim(),
      userAgent: h.get("user-agent") ?? "unknown",
      metadata: { email },
    });
    return { error: friendlyAuthError(error.message) };
  }
  redirect("/dashboard"); // app gate forwards to /onboarding if incomplete
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = validateSignup({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  // A website URL typed on the landing page rides through as ?site= → a hidden field.
  // Stash it on user_metadata so onboarding can pre-fill + scan it, keeping the
  // landing promise ("we'll scan your site"). Cap length; onboarding validates it.
  const site = String(formData.get("site") ?? "").trim().slice(0, 300);

  // Confirmation-free signup (owner call, 2026-07-08): the confirm-link step was
  // losing signups. The admin API creates the user already confirmed — Supabase
  // sends no email — then a normal password sign-in opens the session and the app
  // gate routes to onboarding. The deploy-time email_confirmed_at guards stay
  // satisfied because every user is confirmed at creation.
  const service = createServiceClient();
  const { error: createError } = await service.auth.admin.createUser({
    email: result.values.email,
    password: result.values.password,
    email_confirm: true,
    user_metadata: {
      company_name: result.values.companyName,
      ...(site ? { pending_site: site } : {}),
    },
  });
  if (createError) return { error: friendlyAuthError(createError.message) };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: result.values.email,
    password: result.values.password,
  });
  if (signInError) return { error: friendlyAuthError(signInError.message) };
  redirect("/dashboard"); // app gate forwards to /onboarding
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // always claim success: don't leak which emails exist
  return { sent: true };
}

export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/dashboard");
}

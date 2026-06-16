"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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

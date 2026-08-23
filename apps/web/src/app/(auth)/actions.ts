"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { friendlyAuthError } from "@/lib/auth/errors";
import { safeNext } from "@/lib/auth/safe-next";
import { validateMemberSignup, validateSignup } from "@/lib/validation";
import { sendWelcomeEmail } from "@vantera/transactional-email";
import { siteUrl } from "@/lib/site-url";
import { recordSecurityEvent } from "@/lib/security/audit";
import { recordFunnelEvent } from "@/lib/observability/funnel";

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
  // R3: honor a validated same-origin ?next= (deep links, invite acceptance) — the login
  // action swallowing `next` was silently dead-ending every logged-out invite click.
  redirect(safeNext(formData.get("next")) ?? "/dashboard"); // app gate forwards to /onboarding if incomplete
}

/** R3: signup THROUGH a team invite — the invitee joins the inviting workspace instead of
 *  minting their own (the old flow silently stranded every brand-new invitee in a fresh,
 *  empty account). No company field, no onboarding: the workspace already exists. */
async function signupWithInvite(inviteToken: string, formData: FormData): Promise<AuthFormState> {
  const service = createServiceClient();
  const { data: invite } = await service
    .from("account_invites")
    .select("email, status, expires_at")
    .eq("token", inviteToken)
    .maybeSingle<{ email: string; status: string; expires_at: string }>();
  if (!invite || invite.status !== "pending" || new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: "This invite is no longer valid — ask your teammate to send a fresh one." };
  }

  const result = validateMemberSignup({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    inviteEmail: invite.email,
  });
  if (!result.ok) return { error: result.error };

  // Same confirmation-free creation as the normal path — but NO company metadata and no
  // workspace: membership comes from the invite.
  const { error: createError } = await service.auth.admin.createUser({
    email: result.values.email,
    password: result.values.password,
    email_confirm: true,
  });
  if (createError) {
    await recordFunnelEvent("signup.invite_create_user_failed", { email: result.values.email, error: createError.message });
    return { error: friendlyAuthError(createError.message) };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: result.values.email,
    password: result.values.password,
  });
  if (signInError) {
    await recordFunnelEvent("signup.invite_signin_failed", { email: result.values.email, error: signInError.message });
    return { error: friendlyAuthError(signInError.message) };
  }

  // accept_invite (security definer RPC) re-validates token/expiry/email binding and
  // inserts the membership — the same sanctioned path the logged-in accept uses.
  const { error: acceptError } = await supabase.rpc("accept_invite", { invite_token: inviteToken });
  if (acceptError) {
    await recordFunnelEvent("signup.invite_accept_failed", { email: result.values.email, error: acceptError.message });
    return {
      error: "Your account was created, but the invite could not be accepted — open the invite link again.",
    };
  }
  redirect("/dashboard");
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  if (inviteToken) return signupWithInvite(inviteToken, formData);

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
  if (createError) {
    await recordFunnelEvent("signup.create_user_failed", { email: result.values.email, error: createError.message });
    return { error: friendlyAuthError(createError.message) };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: result.values.email,
    password: result.values.password,
  });
  if (signInError) {
    await recordFunnelEvent("signup.signin_after_create_failed", { email: result.values.email, error: signInError.message });
    return { error: friendlyAuthError(signInError.message) };
  }

  // R5: the welcome email — the first thing the product ever says off-screen (the email
  // channel used to be silent until the weekly summary, 7 days in). Best-effort: a mail
  // hiccup must never break signup. Invite signups skip it (they got the invite email).
  // No lifecycle_last_email_at stamp: the accounts row is created later, in onboarding step 0.
  try {
    await sendWelcomeEmail({ to: result.values.email, appUrl: siteUrl() });
  } catch {
    // no-op — signup continues
  }
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

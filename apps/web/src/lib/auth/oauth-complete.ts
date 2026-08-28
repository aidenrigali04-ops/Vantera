import { safeNext } from "./safe-next";
import { safeInviteToken, safeSite } from "./oauth-redirect";

/** Fresh OAuth users are created during code exchange — welcome only in this window. */
export const OAUTH_NEW_USER_MS = 5 * 60 * 1000;

export type OAuthCallbackInput = {
  code: string | null;
  next?: string | null;
  site?: string | null;
  invite?: string | null;
};

export type OAuthCallbackResult = { ok: boolean; redirectTo: string };

export type OAuthCompleteDeps = {
  exchangeCode: (code: string) => Promise<{ error: { message: string } | null }>;
  getUser: () => Promise<{
    id: string;
    email?: string | null;
    created_at: string;
    user_metadata?: Record<string, unknown> | null;
  } | null>;
  updateUser: (attrs: { data: Record<string, unknown> }) => Promise<void>;
  upsertProfile: (row: {
    user_id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  }) => Promise<void>;
  hasMembership: () => Promise<boolean>;
  acceptInvite: (token: string) => Promise<{ error: { message: string } | null }>;
  sendWelcome: (email: string) => Promise<void>;
  signOut?: () => Promise<void>;
  now?: () => Date;
};

function googleDisplayName(meta: Record<string, unknown> | null | undefined): string {
  const raw = meta?.full_name ?? meta?.name ?? meta?.given_name;
  return typeof raw === "string" ? raw.trim() : "";
}

function googleAvatar(meta: Record<string, unknown> | null | undefined): string | null {
  const raw = meta?.avatar_url ?? meta?.picture;
  return typeof raw === "string" && raw.startsWith("https://") ? raw : null;
}

/**
 * After Google redirects back with a PKCE `code`, exchange it, stash landing-page context,
 * accept a team invite when present, and send the welcome email once for a brand-new user.
 */
export async function completeGoogleOAuth(
  input: OAuthCallbackInput,
  deps: OAuthCompleteDeps
): Promise<OAuthCallbackResult> {
  const failLogin = { ok: false, redirectTo: "/login?error=oauth" };
  const code = input.code?.trim() ?? "";
  if (!code) return failLogin;

  const exchanged = await deps.exchangeCode(code);
  if (exchanged.error) return failLogin;

  const user = await deps.getUser();
  if (!user) return failLogin;

  const now = deps.now ?? (() => new Date());
  const ageMs = now().getTime() - new Date(user.created_at).getTime();
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < OAUTH_NEW_USER_MS;

  const site = safeSite(input.site);
  if (site && fresh) {
    try {
      await deps.updateUser({ data: { pending_site: site } });
    } catch {
      // landing-page prefill is best-effort
    }
  }

  const displayName = googleDisplayName(user.user_metadata);
  const avatarUrl = googleAvatar(user.user_metadata);
  if (fresh && (displayName || avatarUrl)) {
    try {
      await deps.upsertProfile({
        user_id: user.id,
        display_name: displayName || null,
        avatar_url: avatarUrl,
      });
    } catch {
      // profile prefill is best-effort
    }
  }

  const invite = safeInviteToken(input.invite);
  let joinedViaInvite = false;
  if (invite) {
    const accepted = await deps.acceptInvite(invite);
    if (accepted.error?.message.toLowerCase().includes("different email")) {
      try {
        await deps.signOut?.();
      } catch {
        // still bounce them to signup so they can pick the invited account
      }
      const dest = new URL("/signup", "https://vantera.invalid");
      dest.searchParams.set("invite", invite);
      dest.searchParams.set("error", "invite-email");
      return { ok: false, redirectTo: `${dest.pathname}${dest.search}` };
    }
    if (!accepted.error) joinedViaInvite = true;
  }

  const member = await deps.hasMembership();
  if (fresh && !member && !joinedViaInvite && user.email) {
    try {
      await deps.sendWelcome(user.email);
    } catch {
      // best-effort — never block sign-in
    }
  }

  return { ok: true, redirectTo: safeNext(input.next) ?? "/dashboard" };
}

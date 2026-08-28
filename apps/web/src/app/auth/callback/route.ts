import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { sendWelcomeEmail } from "@vantera/transactional-email";
import { completeGoogleOAuth, type OAuthCompleteDeps } from "@/lib/auth/oauth-complete";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

function deps(supabase: Awaited<ReturnType<typeof createClient>>): OAuthCompleteDeps {
  return {
    exchangeCode: async (code) => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return { error: error ? { message: error.message } : null };
    },
    getUser: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    updateUser: async (attrs) => {
      await supabase.auth.updateUser(attrs);
    },
    upsertProfile: async (row) => {
      await supabase.from("user_profiles").upsert(row);
    },
    hasMembership: async () => {
      const { data } = await supabase
        .from("account_members")
        .select("account_id")
        .limit(1)
        .maybeSingle();
      return data != null;
    },
    acceptInvite: async (token) => {
      const { error } = await supabase.rpc("accept_invite", { invite_token: token });
      return { error: error ? { message: error.message } : null };
    },
    sendWelcome: async (email) => {
      await sendWelcomeEmail({ to: email, appUrl: siteUrl() });
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  const result = await completeGoogleOAuth(
    {
      code: searchParams.get("code"),
      next: searchParams.get("next"),
      site: searchParams.get("site"),
      invite: searchParams.get("invite"),
    },
    deps(supabase)
  );
  redirect(result.redirectTo);
}

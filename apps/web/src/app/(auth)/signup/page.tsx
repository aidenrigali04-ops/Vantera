import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { lookupInvite } from "@/lib/auth/invite-lookup";
import { AuthSplit } from "../auth-split";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; invite?: string }>;
}) {
  // Production sends already-authenticated users to the app; local dev keeps the page
  // viewable for design review.
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest && process.env.NODE_ENV !== "development") redirect(dest);
  // The URL a visitor typed on the landing page rides in ?site= so the "we'll scan
  // your site" promise carries into signup and (via onboarding pre-fill) is kept.
  const { site, invite: inviteToken } = await searchParams;

  // R3: signup through a team invite — join the inviting workspace, no company field.
  // A dead token falls back to normal signup with an honest notice.
  const invite = inviteToken ? await lookupInvite(inviteToken) : null;
  return (
    <AuthSplit>
      <SignupForm
        initialSite={site}
        invite={invite?.state === "valid" ? { token: invite.token, email: invite.email, workspaceName: invite.workspaceName } : undefined}
        inviteDead={Boolean(inviteToken) && invite?.state !== "valid"}
      />
    </AuthSplit>
  );
}

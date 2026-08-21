import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { lookupInvite } from "@/lib/auth/invite-lookup";
import { AcceptButton } from "./accept-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * R3: the invite landing page shows WHAT you're joining before any click — workspace,
 * invited address, expiry state — and routes every starting state somewhere that works:
 * logged-in → accept here; logged-out existing user → login (which now honors ?next=);
 * brand-new person → invite-signup (joins THIS workspace instead of minting their own).
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await lookupInvite(token);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>
              {invite?.state === "valid" ? `Join ${invite.workspaceName}` : "Team invitation"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!invite && (
              <p className="text-sm text-muted-foreground">
                This invite link doesn&apos;t exist. Check the link, or ask your teammate to send a
                new one.
              </p>
            )}

            {invite?.state === "used" && (
              <p className="text-sm text-muted-foreground">
                This invite has already been used or was revoked. If you still need access, ask
                your teammate to send a fresh one.
              </p>
            )}

            {invite?.state === "expired" && (
              <p className="text-sm text-muted-foreground">
                This invite to <span className="font-medium text-foreground">{invite.workspaceName}</span>{" "}
                has expired — invites last 7 days. Ask your teammate to resend it from Settings →
                Team.
              </p>
            )}

            {invite?.state === "valid" && (
              <>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve been invited to join{" "}
                  <span className="font-medium text-foreground">{invite.workspaceName}</span> on
                  Vantera as {invite.role === "admin" ? "an admin" : "a member"}. The invite was
                  sent to <span className="font-medium text-foreground">{invite.email}</span>.
                </p>

                {user ? (
                  <AcceptButton token={token} />
                ) : (
                  <div className="space-y-3">
                    <Link
                      href={`/signup?invite=${token}`}
                      className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Create your account &amp; join
                    </Link>
                    <Link
                      href={`/login?next=/invite/${token}`}
                      className="flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      I already have an account — sign in
                    </Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

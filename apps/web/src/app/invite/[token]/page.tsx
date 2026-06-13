import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServiceClient } from "@/lib/supabase/service";
import { AcceptButton } from "./accept-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  // Read invite context via service client (user may not be authenticated yet)
  const svc = createServiceClient();
  const { data: invite } = await svc
    .from("account_invites")
    .select("email, role, status, expires_at, accounts(name)")
    .eq("token", token)
    .maybeSingle<{
      email: string;
      role: string;
      status: string;
      expires_at: string;
      accounts: { name: string } | null;
    }>();

  const isExpired = invite ? new Date(invite.expires_at) < new Date() : false;
  const isValid = invite && invite.status === "pending" && !isExpired;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Team invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!invite && (
              <p className="text-sm text-muted-foreground">
                This invitation link is invalid or has already been used.
              </p>
            )}
            {invite && !isValid && (
              <p className="text-sm text-muted-foreground">
                {isExpired
                  ? "This invitation has expired."
                  : "This invitation is no longer active."}
              </p>
            )}
            {isValid && (
              <>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve been invited to join{" "}
                  <span className="font-medium text-foreground">
                    {invite.accounts?.name ?? "a workspace"}
                  </span>{" "}
                  as a <span className="font-medium text-foreground">{invite.role}</span>.
                </p>
                <AcceptButton token={token} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

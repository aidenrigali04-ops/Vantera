import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptButton } from "./accept-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Team invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You&apos;ve been invited to join a workspace on Vantera. Accept the invitation below
              to get started.
            </p>
            <AcceptButton token={token} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

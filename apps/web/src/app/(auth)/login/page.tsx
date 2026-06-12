import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

// No authenticated-redirect here for now: the owner needs these pages viewable
// while designing. The app-side gate (unauthenticated → /login) still stands.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell>
      <LoginForm linkExpired={error === "link-expired"} />
    </AuthShell>
  );
}

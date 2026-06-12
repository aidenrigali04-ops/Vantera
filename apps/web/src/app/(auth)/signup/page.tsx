import { AuthShell } from "../auth-shell";
import { SignupForm } from "./signup-form";

// No authenticated-redirect here for now: the owner needs these pages viewable
// while designing. The app-side gate (unauthenticated → /login) still stands.
export default function SignupPage() {
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}

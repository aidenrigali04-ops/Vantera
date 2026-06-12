import { Montserrat } from "next/font/google";
import { SignupForm } from "./signup-form";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600"] });

// No authenticated-redirect here for now: the owner needs these pages viewable
// while designing. The app-side gate (unauthenticated → /login) still stands.
export default function SignupPage() {
  return (
    <div className={montserrat.className}>
      <SignupForm />
    </div>
  );
}

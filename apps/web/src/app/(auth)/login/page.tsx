import { Montserrat } from "next/font/google";
import { LoginForm } from "./login-form";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600"] });

// No authenticated-redirect here for now: the owner needs these pages viewable
// while designing. The app-side gate (unauthenticated → /login) still stands.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className={montserrat.className}>
      <LoginForm linkExpired={error === "link-expired"} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const dest = resolveGate("onboarding", toGateContext(await getGateData()));
  if (dest) redirect(dest);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">{children}</div>
    </main>
  );
}

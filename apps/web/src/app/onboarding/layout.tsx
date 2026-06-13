import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { GlassFilter } from "@/components/ui/liquid-glass";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const dest = resolveGate("onboarding", toGateContext(await getGateData()));
  if (dest) redirect(dest);
  return (
    // Forced `.dark` + a fixed dark backdrop keep the dark particle UI regardless
    // of the dashboard theme toggle (matches the auth shell).
    <main className="dark flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div aria-hidden className="fixed inset-0 -z-10 bg-background" />
      <DottedSurface colorTheme="dark" />
      <GlassFilter />
      <div className="w-full max-w-lg">{children}</div>
    </main>
  );
}

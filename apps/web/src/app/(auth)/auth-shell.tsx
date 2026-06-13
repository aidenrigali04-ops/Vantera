import Link from "next/link";
import { Montserrat } from "next/font/google";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { GlassFilter } from "@/components/ui/liquid-glass";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600"] });

/** Centered dark wrapper for the auth pages: particle background + glass filter.
 * Forced `.dark` keeps it dark regardless of the dashboard toggle; the fixed
 * dark backdrop sits behind the particle canvas so the dots stay visible. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`dark ${montserrat.className} flex min-h-screen flex-col items-center justify-center px-6 py-12 font-medium`}
    >
      <div aria-hidden className="fixed inset-0 -z-10 bg-background" />
      <DottedSurface colorTheme="dark" />
      <GlassFilter />
      <div className="mb-8 text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight">
          Vantera
        </Link>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

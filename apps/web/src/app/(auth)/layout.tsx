import Link from "next/link";
import { Montserrat } from "next/font/google";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { GlassFilter } from "@/components/ui/liquid-glass";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600"] });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`${montserrat.className} flex min-h-screen flex-col items-center justify-center px-6 py-12 font-medium`}
    >
      <DottedSurface />
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

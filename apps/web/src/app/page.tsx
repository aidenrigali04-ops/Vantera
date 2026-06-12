import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DottedSurface } from "@/components/ui/dotted-surface";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <DottedSurface />
      <h1 className="text-4xl font-semibold tracking-tight">Vantera</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Sales intelligence run by SDR agents — prospect, score, and outreach
        only high-quality leads.
      </p>
      <div className="mt-2 flex gap-3">
        <Button asChild>
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}

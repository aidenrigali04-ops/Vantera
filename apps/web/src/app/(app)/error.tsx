"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * R1c: the app-shell error boundary. A failed page renders a branded retry surface inside
 * the normal chrome — never a white screen, and never fake-empty data.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Couldn&apos;t load this page
      </p>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Something went wrong loading your data.
      </h1>
      <p className="text-sm text-muted-foreground">
        Nothing was changed and your agents keep running. This is usually momentary — try again.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={() => reset()} size="sm">
          <RotateCcw className="size-4" /> Try again
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">Back to Results</Link>
        </Button>
      </div>
    </div>
  );
}

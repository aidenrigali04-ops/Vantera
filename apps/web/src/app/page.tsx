import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { TextEffect } from "@/components/ui/text-effect";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <DottedSurface />
      <TextEffect
        as="h1"
        per="word"
        preset="blur"
        className="max-w-3xl text-4xl font-semibold tracking-tight"
      >
        Welcome to Your Agentic SDR Sales Intelligence System
      </TextEffect>
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

import Link from "next/link";
import { Montserrat } from "next/font/google";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { TextEffect } from "@/components/ui/text-effect";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500"] });

export default function Home() {
  return (
    <main
      className={`${montserrat.className} flex flex-1 flex-col items-center justify-start gap-4 px-6 pt-[18vh] text-center font-medium`}
    >
      <DottedSurface />
      <TextEffect
        as="h1"
        per="word"
        preset="blur"
        className="max-w-4xl text-5xl font-medium tracking-tight md:text-6xl"
      >
        Welcome to Your Agentic SDR Sales Intelligence System
      </TextEffect>
      <div className="mt-2 flex gap-3">
        <Link
          href="/signup"
          className="rounded-[18px] bg-[#121317] px-6 py-2.5 text-[17.5px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-[18px] border border-[rgba(33,34,38,0.06)] bg-[rgba(183,191,217,0.1)] px-6 py-2.5 text-[17.5px] font-medium text-[#121317] transition-colors hover:bg-[rgba(183,191,217,0.18)]"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}

import { TextEffect } from "@/components/ui/text-effect";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { HeroCtas } from "./hero-ctas";

/**
 * The original minimal hero — animated particle background (scoped to this
 * section only) + the blurred-word headline. Full-height so the first screen is
 * only the heading and CTAs; the simulation lives one scroll down.
 */
export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center"
    >
      <DottedSurface colorTheme="dark" contained />

      <div className="relative z-10">
        <TextEffect
          as="h1"
          per="word"
          preset="blur"
          className="font-heading mx-auto max-w-4xl text-5xl font-medium tracking-tight text-foreground md:text-6xl"
        >
          Welcome to Your Agentic SDR Sales Intelligence System
        </TextEffect>

        <div className="mt-12">
          <HeroCtas />
        </div>
      </div>
    </section>
  );
}

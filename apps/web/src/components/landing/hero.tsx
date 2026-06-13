import { TextEffect } from "@/components/ui/text-effect";
import { HeroCtas } from "./hero-ctas";

/**
 * The original minimal hero — animated particle background (mounted page-level
 * via DottedSurface) + the blurred-word headline. Full-height so the first
 * screen is only the heading and CTAs; the simulation lives one scroll down.
 */
export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center"
    >
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
    </section>
  );
}

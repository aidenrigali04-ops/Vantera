import { DottedSurface } from "@/components/ui/dotted-surface";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { SimulateSection } from "@/components/landing/simulate-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { AgentsSection } from "@/components/landing/agents-section";
import { Outcomes } from "@/components/landing/outcomes";
import { Trust } from "@/components/landing/trust";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

export default function Home() {
  return (
    // Landing is always dark. No opaque background here — the dark body shows
    // through so the fixed particle canvas (-z-1) stays visible behind content.
    <div className="dark relative min-h-screen w-full overflow-x-clip text-foreground">
      <DottedSurface colorTheme="dark" />
      <LandingNav />
      <main>
        <Hero />
        <SimulateSection />
        <HowItWorks />
        <AgentsSection />
        <Outcomes />
        <Trust />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

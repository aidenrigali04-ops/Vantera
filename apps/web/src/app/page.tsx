import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DeepAnalyst } from "@/components/landing/deep-analyst";
import { NoVariables } from "@/components/landing/no-variables";
import { SequenceSection } from "@/components/landing/sequence-section";
import { AgentsSection } from "@/components/landing/agents-section";
import { Outcomes } from "@/components/landing/outcomes";
import { Contrast } from "@/components/landing/contrast";
import { Trust } from "@/components/landing/trust";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

export default function Home() {
  return (
    // Landing is always dark. The particle field is scoped to the hero section
    // (see Hero) — no page-level background here.
    <div className="dark relative min-h-screen w-full overflow-x-clip bg-background text-foreground">
      <LandingNav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <DeepAnalyst />
        <NoVariables />
        <SequenceSection />
        <AgentsSection />
        <Outcomes />
        <Contrast />
        <Trust />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

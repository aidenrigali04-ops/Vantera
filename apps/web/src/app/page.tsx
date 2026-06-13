import { DottedSurface } from "@/components/ui/dotted-surface";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { AgentsSection } from "@/components/landing/agents-section";
import { Outcomes } from "@/components/landing/outcomes";
import { Trust } from "@/components/landing/trust";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

export default function Home() {
  return (
    // Landing is always dark (the brand marketing surface), independent of the
    // dashboard-only theme toggle. Forcing `.dark` keeps it dark even if a
    // returning user switched the dashboard to light.
    <div className="dark relative min-h-screen w-full overflow-x-clip bg-background text-foreground">
      <DottedSurface className="opacity-30" />
      <LandingNav />
      <main>
        <Hero />
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

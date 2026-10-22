import type { ComponentType, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Laurel } from "./laurel-badges";
import { ONBOARDING_MINUTES } from "./claims";
import { ClaudeMark, HubSpotMark, LinkedinMark, McpMark, SalesforceMark, SlackMark } from "./brand-glyphs";

/**
 * The band under the hero, after rankbox.xyz's proof band (itself after Rankaria's
 * "As seen on" strip): a hairline band inside the page rails, framed by a laurel wing
 * at each end, holding three proof points: what Vantera works with, how long setup
 * takes (ONBOARDING_MINUTES, claims.ts), and the one network it is built for.
 *
 * The "Works with" marks rest in greyscale like a press strip and take their own
 * colour on hover; the LinkedIn mark is set in the Vantera blue. Only integrations
 * Vantera really has appear (integrations.tsx); white-labeled vendors never do
 * (rules 03/04/05).
 */

const LINE = "border-[var(--hairline)]";

const MARKS: { name: string; color: string; Mark: ComponentType<{ className?: string }> }[] = [
  { name: "HubSpot", color: "#ff5c35", Mark: HubSpotMark },
  { name: "Salesforce", color: "#00a1e0", Mark: SalesforceMark },
  { name: "Slack", color: "#4a154b", Mark: SlackMark },
  { name: "Claude", color: "#d97757", Mark: ClaudeMark },
  { name: "MCP", color: "#0a0c12", Mark: McpMark },
];

function Label({ children }: { children: string }) {
  return (
    <span className="whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-[var(--ink-3)]/85 sm:text-[0.64rem] sm:tracking-[0.2em]">
      {children}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <>
      <span className="text-[1.3rem] font-bold leading-none tracking-tight text-foreground/75">
        {value}
      </span>
      <Label>{label}</Label>
    </>
  );
}

export function TrustStrip() {
  return (
    // Top hairline only: the band that follows draws the line under this one.
    <section aria-label="What Vantera works with" className={cn("border-t bg-white", LINE)}>
      <div className={cn("relative mx-auto max-w-6xl border-x", LINE)}>
        <Laurel className="pointer-events-none absolute left-5 top-1/2 hidden h-[68px] w-auto -translate-y-1/2 text-[rgba(12,16,26,0.1)] md:block" />
        <Laurel
          flip
          className="pointer-events-none absolute right-5 top-1/2 hidden h-[68px] w-auto -translate-y-1/2 text-[rgba(12,16,26,0.1)] md:block"
        />

        <div className="grid grid-cols-2 md:mx-16 md:grid-cols-[1.5fr_1fr_1fr]">
          <div
            className={cn(
              "col-span-2 flex h-[72px] items-center justify-center gap-3 border-b md:col-span-1 md:border-b-0 md:border-r",
              LINE,
            )}
          >
            <Label>Works with</Label>
            <span className="flex items-center gap-0.5">
              {MARKS.map(({ name, color, Mark }) => (
                <span
                  key={name}
                  title={name}
                  style={{ "--mark": color } as CSSProperties}
                  className="grid size-8 place-items-center rounded-lg text-[#8e96a1] transition-[color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[rgba(12,16,26,0.035)] hover:text-[var(--mark)]"
                >
                  <Mark className="size-[17px]" />
                </span>
              ))}
            </span>
          </div>

          <div className={cn("flex h-[72px] items-center justify-center gap-2 border-r sm:gap-2.5", LINE)}>
            <Stat value={`${ONBOARDING_MINUTES} min`} label="To set up" />
          </div>

          <div className="group/li flex h-[72px] items-center justify-center gap-2 sm:gap-2.5">
            <Label>Built for</Label>
            <span className="flex items-center gap-1.5 text-[1.05rem] font-semibold tracking-tight text-foreground/70 transition-colors group-hover/li:text-foreground">
              <LinkedinMark className="size-[17px] text-[var(--fb)]" />
              LinkedIn
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

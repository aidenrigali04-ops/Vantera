import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { Accent, Band, CELL, CellGrid, GhostLink, Pill, Spacer } from "@/components/landing/frame";
import { getLiveTool, type Tool } from "@/lib/tools/registry";

/**
 * "Put the playbooks to work", after rankbox.xyz's blog: three free tools for the steps
 * the guides walk through, in a band of hairline cells. Only live tools appear; the
 * tools run without an account.
 */

const PICKS = ["cold-outreach-generator", "follow-up-message-generator", "linkedin-profile-analyzer"];

export function ToolsBand() {
  const tools = PICKS.map((slug) => getLiveTool(slug)).filter((t): t is Tool => !!t);
  if (!tools.length) return null;
  return (
    <section aria-labelledby="tools-title">
      <Spacer />
      <Band inner="flex flex-col gap-5 px-6 py-10 sm:px-10 md:flex-row md:items-end md:justify-between lg:px-12">
        <div>
          <Pill icon={Wrench}>Free tools</Pill>
          <h2
            id="tools-title"
            className="mt-4 text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-foreground sm:text-[1.9rem]"
          >
            Put the playbooks <Accent>to work</Accent>
          </h2>
          <p className="mt-2 max-w-xl text-[0.95rem] text-[var(--ink-3)]">
            Free, no-signup tools for the steps these guides walk through.
          </p>
        </div>
        <div className="shrink-0">
          <GhostLink href="/tools">All free tools</GhostLink>
        </div>
      </Band>
      <Band>
        <CellGrid className="md:grid-cols-3">
          {tools.map(({ slug, name, tagline, icon: Icon }) => (
            <li key={slug} className={CELL}>
              <Link
                href={`/tools/${slug}`}
                className="group flex h-full flex-col p-6 outline-none transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--tint)_55%,white)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(24,119,242,0.4)] sm:p-8"
              >
                <span className="flex size-9 items-center justify-center rounded-lg border border-[rgba(12,16,26,0.08)] bg-white text-foreground/75 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors group-hover:border-[var(--fb-strong)] group-hover:bg-[var(--fb-strong)] group-hover:text-white">
                  <Icon className="size-4" />
                </span>
                <p className="mt-5 text-[1.02rem] font-semibold tracking-tight text-foreground">{name}</p>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--ink-3)]">{tagline}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fb-strong)]">
                  Open tool
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </Link>
            </li>
          ))}
        </CellGrid>
      </Band>
    </section>
  );
}

import Link from "next/link";
import { BarChart3, LayoutDashboard, Workflow, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The Results surface (Surface B — the confirmation loop) is one destination with three views,
// consolidated from the former Dashboard / Analytics / Pipeline pages. Overview is the home;
// Analytics is the funnel + ROI proof; Pipeline is the live autonomous process. State lives in the
// `?view=` param so each tab is server-rendered and deep-linkable (copilot navigates straight to it).
export type ResultsView = "overview" | "analytics" | "pipeline";

const TABS: { key: ResultsView; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "pipeline", label: "Pipeline", icon: Workflow },
];

export function resolveView(v: string | undefined): ResultsView {
  return v === "analytics" || v === "pipeline" ? v : "overview";
}

export function ResultsTabsBar({ active }: { active: ResultsView }) {
  return (
    <div className="mx-auto mb-6 flex max-w-5xl" data-copilot="results-tabs">
      {/* Segmented control (Stripe/Vercel idiom) — a single bordered track; the active view is a
          raised white segment. Replaces the old full-pill tabs. */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-1">
        {TABS.map((t) => {
          const href = t.key === "overview" ? "/dashboard" : `/dashboard?view=${t.key}`;
          const isActive = t.key === active;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-foreground shadow-[var(--shadow-sm)] ring-1 ring-[var(--hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

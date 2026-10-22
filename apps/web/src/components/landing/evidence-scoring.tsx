import { ScreenCard, ScreenNote, ScreenRow } from "./feature-row";

/**
 * The evidence row's screen — "How do you know these are the right people?" A
 * prospect's fit score with its math open (marketing never hides it behind a click),
 * after rankbox's "Article Score" card. The two-stage model is the real one (rule 06):
 * a deterministic fit gate on ICP, then an AI rank on signals. The 70 threshold and the
 * suppression line are the product's actual gates (rule 11). Sample data; the points
 * sum to the score.
 */

const POINTS: { label: string; pts: string }[] = [
  { label: "Title match", pts: "+24" },
  { label: "Seniority", pts: "+12" },
  { label: "Headcount 11–50", pts: "+10" },
  { label: "Posted about pipeline pain · 3d", pts: "+30" },
  { label: "Active this week", pts: "+15" },
];

export function FitScoreScreen() {
  return (
    <ScreenCard
      title="Fit score"
      meta={
        <span className="text-2xl font-semibold leading-none text-[#13824a]">
          91<span className="text-sm text-[var(--ink-3)]">/100</span>
        </span>
      }
    >
      <div className="space-y-1.5">
        {POINTS.map((p) => (
          <ScreenRow key={p.label} label={p.label} value={p.pts} />
        ))}
      </div>
      <ScreenNote>Only 70+ enters outreach. Suppressed contacts are never messaged.</ScreenNote>
    </ScreenCard>
  );
}

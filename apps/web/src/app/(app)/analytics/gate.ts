// Which Results blocks render. Counts never wait on money: the funnel and the source table
// show as soon as there is one prospect. Dollar figures gate only on what dollars need — a
// deal value (to price pipeline) and a plan (to divide by spend) — and otherwise one hint
// line names the single missing input, value first.
export type VisibleBlocks = {
  funnel: boolean;
  sources: boolean;
  dollars: boolean;
  dollarsHint: "value" | "spend" | null;
};

export function visibleBlocks(i: { found: number; hasValue: boolean; hasSpend: boolean }): VisibleBlocks {
  if (i.found <= 0) return { funnel: false, sources: false, dollars: false, dollarsHint: null };
  const dollars = i.hasValue && i.hasSpend;
  return {
    funnel: true,
    sources: true,
    dollars,
    dollarsHint: dollars ? null : !i.hasValue ? "value" : "spend",
  };
}

import { Eyebrow } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import type { ProofRow } from "@/lib/proof/types";

// "Where prospects come from" — one hairline table (rule 07): sticky header, 11px uppercase
// header cells, tabular numbers, row hover. Source rows grouped Signals / Intent watchlist /
// Other, then the agents block. No overflow-hidden on the container — it would kill the sticky thead.

const GROUPS: { group: ProofRow["group"]; label: string }[] = [
  { group: "signal", label: "Signals" },
  { group: "intent", label: "Intent watchlist" },
  { group: "other", label: "Other" },
];
const COLUMNS = ["Found", "Contacted", "Accepted", "Replied", "Interested", "Closed"] as const;

const n = (v: number) => v.toLocaleString("en-US");

function Th({ children, first, last }: { children: React.ReactNode; first?: boolean; last?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-[var(--line)] bg-[var(--tint)] px-3 py-3 font-semibold tracking-[0.06em] sm:px-4",
        first ? "text-left" : "text-right",
        first && "w-[28%] rounded-tl-xl",
        last && "rounded-tr-xl",
      )}
    >
      {children}
    </th>
  );
}

/** One <tbody> per group; the header cell names the row group for assistive tech. */
function GroupBody({ label, rows, prefix }: { label: string; rows: ProofRow[]; prefix: string }) {
  return (
    <tbody className="border-t border-[var(--line)] first-of-type:border-t-0">
      <tr>
        <th
          scope="rowgroup"
          colSpan={COLUMNS.length + 1}
          className="px-3 pb-1.5 pt-4 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-4"
        >
          {label}
        </th>
      </tr>
      {rows.map((r) => (
        <Row key={`${prefix}-${r.key}`} row={r} />
      ))}
    </tbody>
  );
}

function Row({ row }: { row: ProofRow }) {
  const cells = [row.found, row.contacted, row.accepted, row.replied, row.interested, row.closed];
  return (
    <tr className="border-t border-[var(--line)] transition-colors hover:bg-[var(--cyan-tint)]/50">
      <th scope="row" className="max-w-0 truncate px-3 py-3 text-left font-normal text-foreground sm:px-4">
        {row.label}
      </th>
      {cells.map((v, i) => (
        <td key={COLUMNS[i]} className="px-3 py-3 text-right font-data tabular-nums sm:px-4">
          {v === null ? <span className="text-muted-foreground">—</span> : n(v)}
        </td>
      ))}
    </tr>
  );
}

export function ProofTable({
  sources,
  agents,
  capped,
}: {
  sources: ProofRow[];
  agents: ProofRow[];
  capped: boolean;
}) {
  const groups = GROUPS.map((g) => ({ ...g, rows: sources.filter((r) => r.group === g.group) })).filter(
    (g) => g.rows.length > 0,
  );
  return (
    <section>
      <Eyebrow>Where prospects come from</Eyebrow>
      {/* Phones scroll the table sideways; from lg the container stays overflow-visible so the
          sticky thead keeps working against the page's lg scroll region. */}
      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] max-lg:overflow-x-auto lg:overflow-visible">
        <table className="w-full min-w-[600px] table-fixed text-sm">
          <caption className="sr-only">Where prospects come from</caption>
          <thead className="sticky top-0 z-10 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th first>Source</Th>
              {COLUMNS.map((c, i) => (
                <Th key={c} last={i === COLUMNS.length - 1}>
                  {c}
                </Th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <GroupBody key={g.group} label={g.label} rows={g.rows} prefix={g.group} />
          ))}
          {agents.length > 0 && <GroupBody label="Agents" rows={agents} prefix="agent" />}
        </table>
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">
        A prospect with several signals counts once in each row.
        {capped && " Showing the first 5,000 rows."}
      </p>
    </section>
  );
}

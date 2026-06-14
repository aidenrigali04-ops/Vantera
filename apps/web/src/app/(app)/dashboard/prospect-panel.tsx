"use client";

import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { LeadProfileSheet, type LeadProfile } from "@/components/lead-profile";

export type Prospect = LeadProfile;

function name(p: Prospect): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

function topSignal(p: Prospect): string | null {
  return p.ai_insights?.triggers?.[0] ?? p.ai_insights?.pain_points?.[0] ?? null;
}

export function ProspectPanel({ prospects }: { prospects: Prospect[] }) {
  const [selected, setSelected] = useState<Prospect | null>(null);

  if (prospects.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Qualified prospects appear here as your Prospect Agent sources and enriches them.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left font-mono text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-white/[0.04]">
            <tr>
              <th className="px-4 py-2 font-medium">Prospect</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Company</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Top signal</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 text-right font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelected(p)}
                className="cursor-pointer border-t border-black/[0.05] transition-colors hover:bg-foreground/[0.04] dark:border-white/[0.06]"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{name(p)}</p>
                  {p.title && <p className="text-xs text-muted-foreground">{p.title}</p>}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <p>{p.company_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.company_size && `${p.company_size} emp`, p.location].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="hidden max-w-[16rem] px-4 py-3 md:table-cell">
                  <p className="truncate text-xs text-muted-foreground">{topSignal(p) ?? "—"}</p>
                </td>
                <td className="px-4 py-3 font-mono font-medium tabular-nums">{p.ai_score ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1.5">
                    <Mail className={`size-4 ${p.email ? "text-foreground" : "text-muted-foreground/30"}`} />
                    <MessageSquare
                      className={`size-4 ${p.linkedin_url ? "text-foreground" : "text-muted-foreground/30"}`}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <LeadProfileSheet lead={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

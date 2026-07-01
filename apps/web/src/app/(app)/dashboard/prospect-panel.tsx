"use client";

import { useRouter } from "next/navigation";
import { Mail, MessageSquare } from "lucide-react";
import type { LeadProfile } from "@/components/lead-profile";
import { leadSignalLine } from "../leads/lead-value";

export type Prospect = LeadProfile;

function name(p: Prospect): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

export function ProspectPanel({ prospects }: { prospects: Prospect[] }) {
  const router = useRouter();

  if (prospects.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Qualified prospects appear here as your pipeline sources and enriches them.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--hairline)]">
      <table className="w-full text-sm">
        <thead className="bg-foreground/[0.03] text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Prospect</th>
            <th className="hidden px-4 py-2 font-medium sm:table-cell">Company</th>
            <th className="hidden px-4 py-2 font-medium md:table-cell">Why now</th>
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 text-right font-medium">Data</th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((p) => (
            <tr
              key={p.id}
              onClick={() => p.id && router.push(`/leads/${p.id}`)}
              className="cursor-pointer border-t border-[var(--hairline)] transition-colors hover:bg-[var(--tint)]"
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
                <p className="truncate text-xs text-muted-foreground">
                  {leadSignalLine(p.lead_signals, p.ai_insights) ?? "—"}
                </p>
              </td>
              <td className="px-4 py-3 font-data font-medium tabular-nums">{p.ai_score ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="flex justify-end gap-1.5">
                  <Mail className={`size-4 ${p.email ? "text-[var(--cyan-strong)]" : "text-muted-foreground/30"}`} />
                  <MessageSquare
                    className={`size-4 ${p.linkedin_url ? "text-[var(--cyan-strong)]" : "text-muted-foreground/30"}`}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

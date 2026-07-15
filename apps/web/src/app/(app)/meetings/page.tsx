import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orThrow } from "@/lib/supabase/guard";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";

export const metadata = { title: "Meetings — Vantera" };

/**
 * The Meetings surface (L1, spec 2026-07-15): every booked meeting in one place — the
 * in-app destination the funnel (and the hero calendar) points at. Real data only; the
 * empty state is honest and points at the one action that produces meetings.
 */

type MeetingRow = {
  id: string;
  meeting_booked_at: string;
  meeting_at: string | null;
  meeting_source: string | null;
  status: string;
  leads: never; // placeholder — fields come from the spread select below
};

const fmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const fmtDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default async function MeetingsPage() {
  const supabase = await createClient();
  // RLS scopes to the session's account (rule 02).
  const res = await supabase
    .from("leads")
    .select(`meeting_booked_at, meeting_at, meeting_source, ${LEAD_PROFILE_FIELDS}`)
    .not("meeting_booked_at", "is", null)
    .order("meeting_booked_at", { ascending: false })
    .returns<(LeadProfile & Omit<MeetingRow, "id" | "leads">)[]>();
  const meetings = orThrow(res, "your meetings") ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meetings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every booked meeting your outreach produced — the number the whole system works for.
        </p>
      </header>

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--hairline)] bg-white/60 py-16 text-center">
          <CalendarCheck2 className="size-7 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Your first booked meeting lands here. Make sure your{" "}
            <Link href="/agents/copy/edit" className="font-medium text-foreground underline underline-offset-4">
              booking link
            </Link>{" "}
            is set — Vera offers it the moment a prospect shows interest.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--hairline)] bg-white/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Prospect</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Company</th>
                <th className="px-4 py-3 font-medium">Meeting</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Recorded</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => {
                const name =
                  [m.first_name, m.last_name].filter(Boolean).join(" ") || "A prospect";
                return (
                  <tr key={m.id} className="border-t border-[var(--hairline)] hover:bg-[var(--cyan-tint)]/40">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <LeadProfileLink lead={m}>{name}</LeadProfileLink>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {m.company_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-data">
                      {m.meeting_at ? fmt.format(new Date(m.meeting_at)) : "time not captured"}
                    </td>
                    <td className="hidden px-4 py-3 font-data text-muted-foreground md:table-cell">
                      {fmtDay.format(new Date(m.meeting_booked_at))}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {m.meeting_source === "agent" ? "Detected from the reply" : "Marked by you"}
                    </td>
                    <td className="px-4 py-3">
                      {m.status === "converted" ? "Closed-won" : "Booked"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

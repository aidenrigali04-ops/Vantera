import { Mail, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { summarizeChannelReadiness, type WarmupStatus } from "@/lib/warmup-status";

// Channel-readiness header — the page's value-proof + endowed-progress surface.
// Turns a flat stack of setup cards into a legible "is outreach live yet?" track so
// the user can see channels coming online (and how close email is) instead of warming
// in silence. Pure presentation over the tested WarmupStatus DTO; no data access here.
export function ChannelReadiness({ warmup }: { warmup: WarmupStatus }) {
  const s = summarizeChannelReadiness(warmup);
  const pct = Math.round((s.channelsLive / s.channelsTotal) * 100);

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {s.readyToSend ? "You’re ready to send" : "No channel is live yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {s.readyToSend
              ? `${s.channelsLive} of ${s.channelsTotal} channels live — your agents can start reaching out.`
              : "Connect a channel below so your agents can start outreach today."}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {s.channelsLive}/{s.channelsTotal}
        </span>
      </div>

      {/* goal-gradient: visible progress toward "channels live" */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ReadinessChip
          icon={<UserPlus className="size-3.5" />}
          label="LinkedIn"
          state={s.linkedin === "active" ? "live" : "off"}
          note={s.linkedin === "active" ? "Active" : "Not connected"}
        />
        <ReadinessChip
          icon={<Mail className="size-3.5" />}
          label="Email"
          state={s.email === "ready" ? "live" : s.email === "warming" ? "pending" : "off"}
          note={
            s.email === "ready"
              ? "Ready"
              : s.email === "warming"
                ? s.emailEtaDays !== null
                  ? `Warming — ~${s.emailEtaDays}d to send`
                  : "Warming up"
                : "Not set up"
          }
        />
      </div>
    </section>
  );
}

function ReadinessChip({
  icon,
  label,
  state,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  state: "live" | "pending" | "off";
  note: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        state === "off" ? "border-dashed border-border" : "border-border bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex items-center",
          state === "live" && "text-green-600 dark:text-green-500",
          state === "pending" && "text-amber-600 dark:text-amber-500",
          state === "off" && "text-muted-foreground/60"
        )}
      >
        {icon}
      </span>
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground">{note}</span>
    </span>
  );
}

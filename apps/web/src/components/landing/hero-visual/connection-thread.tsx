"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Check, MessageSquare, CalendarCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE } from "@/components/ui/panel";

/**
 * Alternative hero visual (kept as a drop-in for LiveWinsFeed). One glowing thread runs the
 * full LinkedIn motion end-to-end — invite → accepted → reply → meeting → pipeline — lighting
 * up step by step on a loop, ending on a concrete $ result. Representative sample (honesty
 * contract). To use: render <ConnectionThread /> where Hero renders <LiveWinsFeed />.
 */

const STEPS = [
  { icon: UserPlus, label: "Connection invite sent", who: "VP of Engineering · SF startup" },
  { icon: Check, label: "Accepted", who: "now a 1st-degree connection" },
  { icon: MessageSquare, label: "Replied — interested", who: "“tell me more”" },
  { icon: CalendarCheck, label: "Meeting booked", who: "Thursday, 2:00pm" },
  { icon: TrendingUp, label: "$48k added to pipeline", who: "synced to your CRM" },
] as const;

const STEP_MS = 1100;

export function ConnectionThread() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % (STEPS.length + 2)), STEP_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={cn(PANEL_SURFACE, "mx-auto w-full max-w-md overflow-hidden rounded-3xl p-6 text-left")}>
      <div className="mb-5 flex items-center gap-2.5">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/60" />
          <span className="relative inline-flex size-2 rounded-full bg-foreground" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/80">
          One connection → revenue
        </span>
      </div>

      <div className="relative flex flex-col gap-4">
        {/* the thread */}
        <span className="absolute left-[18px] top-2 bottom-2 w-px bg-white/10" />
        {STEPS.map((s, i) => {
          const on = i <= active;
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={false}
              animate={{ opacity: on ? 1 : 0.35 }}
              transition={{ duration: 0.4 }}
              className="relative flex items-center gap-3.5"
            >
              <span
                className={cn(
                  "z-10 flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                  on ? "border-white/40 bg-white/[0.1] text-foreground" : "border-white/12 bg-white/[0.03] text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", on ? "text-foreground" : "text-muted-foreground")}>{s.label}</p>
                <p className="truncate text-xs text-muted-foreground">{s.who}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-5 border-t border-white/[0.08] pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
        Sample activity
      </p>
    </div>
  );
}

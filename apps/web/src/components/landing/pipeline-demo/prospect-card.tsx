"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Mail, Phone, Zap, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { WARM, WARM_GRADIENT } from "../landing-theme";
import type { Channel, Prospect } from "./sim-data";
import type { Phase } from "./use-pipeline-simulation";
import { CountUp } from "./count-up";
import { LinkedinGlyph } from "./brand-icons";

const CHANNEL_ICON: Record<Channel, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  linkedin: LinkedinGlyph,
  call: Phone,
};

function initials(p: Prospect) {
  return `${p.firstName[0]}${p.lastName[0]}`;
}

function StatusChip({ p, phase, reached }: { p: Prospect; phase: Phase; reached: (p: Phase) => boolean }) {
  let label = "Sourced";
  let warm = false;
  let booked = false;
  if (reached("sending")) {
    if (p.booked) {
      label = "Meeting booked";
      warm = true;
      booked = true;
    } else if (p.replied) {
      label = "Replied";
      warm = true;
    } else {
      label = "Sent";
    }
  } else if (reached("drafting")) {
    label = "Drafted";
  } else if (reached("scoring")) {
    label = "Scored";
  } else if (reached("enriching")) {
    label = phase === "enriching" ? "Enriching…" : "Enriched";
  } else if (reached("gating")) {
    label = "Qualified";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors",
        warm ? "text-background" : "border border-white/10 text-muted-foreground",
      )}
      style={warm ? { backgroundImage: WARM_GRADIENT } : undefined}
    >
      {booked && <CalendarCheck className="size-2.5" strokeWidth={2.5} />}
      {label}
    </span>
  );
}

function Chip({ children, valid }: { children: React.ReactNode; valid?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
      {valid && <Check className="size-2.5 text-emerald-400" strokeWidth={3} />}
      {children}
    </span>
  );
}

export function ProspectRow({
  prospect: p,
  phase,
  reached,
  index,
}: {
  prospect: Prospect;
  phase: Phase;
  reached: (p: Phase) => boolean;
  index: number;
}) {
  const filtered = !p.fit && reached("gating");
  const showEnrich = p.fit && reached("enriching");
  const showScore = p.fit && reached("scoring");
  const showChannels = p.fit && reached("drafting");

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{
        opacity: filtered ? 0.38 : 1,
        y: 0,
        filter: "blur(0px)",
      }}
      transition={{ duration: 0.5, delay: index * 0.07, layout: { duration: 0.35 } }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition-colors",
        showScore && "border-white/15 bg-white/[0.035]",
        p.booked && reached("sending") && "border-[color:var(--warm)] bg-white/[0.05]",
      )}
      style={{ ["--warm" as string]: `${WARM.c2}66` }}
    >
      {/* Primary row */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full font-mono text-[11px] font-medium",
            filtered ? "bg-white/5 text-muted-foreground line-through" : "bg-white/[0.06] text-foreground/80",
          )}
        >
          {initials(p)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("truncate text-sm font-medium text-foreground", filtered && "line-through")}>
              {p.firstName} {p.lastName}
            </span>
            {filtered ? (
              <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                off-ICP · skipped
              </span>
            ) : (
              <StatusChip p={p} phase={phase} reached={reached} />
            )}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {p.title} · {p.company} · {p.location}
          </div>
        </div>

        {/* Score badge */}
        <AnimatePresence>
          {showScore && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="shrink-0 text-right"
            >
              <div
                className="bg-clip-text font-mono text-lg leading-none font-semibold text-transparent"
                style={{ backgroundImage: WARM_GRADIENT }}
              >
                <CountUp to={p.score} active duration={900} format={(n) => String(Math.round(n))} />
              </div>
              <div className="font-mono text-[9px] tracking-wide text-muted-foreground">ai score</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Enrichment chips */}
      <AnimatePresence>
        {showEnrich && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2 flex flex-wrap items-center gap-1.5"
          >
            <Chip valid>{p.email}</Chip>
            {p.phoneValid && <Chip valid>{p.phone}</Chip>}
            <Chip>{p.companySize}</Chip>
            {p.techStack.slice(0, 2).map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-background"
              style={{ backgroundImage: WARM_GRADIENT }}
            >
              <Zap className="size-2.5" strokeWidth={2.5} /> {p.signal}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI insight + channels */}
      <AnimatePresence>
        {showScore && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <span className="text-[11px] text-foreground/70">
              <span className="font-mono text-[10px] text-muted-foreground">aha · </span>
              {p.ahaMoment}
            </span>
            {showChannels && (
              <span className="ml-auto flex items-center gap-1.5">
                {p.channels.map((c) => {
                  const Icon = CHANNEL_ICON[c];
                  return (
                    <span
                      key={c}
                      className="grid size-5 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-foreground/70"
                    >
                      <Icon className="size-3" />
                    </span>
                  );
                })}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

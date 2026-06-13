"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { WARM_GRADIENT } from "../landing-theme";
import type { Channel, Prospect } from "./sim-data";
import { LinkedinGlyph } from "./brand-icons";

const META: Record<Channel, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  email: { icon: Mail, label: "Email" },
  linkedin: { icon: LinkedinGlyph, label: "LinkedIn" },
  call: { icon: Phone, label: "Call brief" },
};

function useTypewriter(text: string, active: boolean, reduced: boolean, speed = 14) {
  // `typed` is only written from the interval callback (async); the inactive and
  // reduced-motion states are derived, so the effect never sets state directly.
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!active || reduced) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      setTyped(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, active, reduced, speed]);
  return !active ? "" : reduced ? text : typed;
}

/** The Outreach Agent drafting a personalized message for the featured prospect. */
export function ChannelDraft({
  prospect,
  active,
  reduced,
}: {
  prospect: Prospect;
  active: boolean;
  reduced: boolean;
}) {
  const channels = prospect.channels.length ? prospect.channels : (["email"] as Channel[]);
  const [channel, setChannel] = useState<Channel>(channels[0]);
  const [autoTyped, setAutoTyped] = useState(false);

  const draftBody = useMemo(() => {
    if (channel === prospect.draft.channel) return prospect.draft.body;
    // Lightweight re-voice for non-primary channels so each tab feels distinct.
    if (channel === "linkedin")
      return `Hi ${prospect.firstName}, congrats on the recent momentum at ${prospect.company} — would love to compare notes on ${prospect.painPoints[0]?.toLowerCase()}.`;
    return `Opener: reference ${prospect.triggers[0]?.replace(/\s*\(.*\)$/, "").toLowerCase()}. Goal: book 20 minutes on ${prospect.painPoints[0]?.toLowerCase()}.`;
  }, [channel, prospect]);

  // Only the first channel types out automatically; tab switches show full text.
  const shouldType = active && !autoTyped && channel === channels[0];
  const typed = useTypewriter(draftBody, shouldType, reduced);
  const display = shouldType ? typed : draftBody;

  useEffect(() => {
    if (!active || reduced) return;
    const t = window.setTimeout(() => setAutoTyped(true), draftBody.length * 7 + 400);
    return () => window.clearTimeout(t);
  }, [active, reduced, draftBody.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
          outreach agent · drafting for {prospect.firstName}
        </span>
        <div className="flex items-center gap-1">
          {channels.map((c) => {
            const { icon: Icon } = META[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setAutoTyped(true);
                  setChannel(c);
                }}
                className={cn(
                  "grid size-6 place-items-center rounded-md border transition-colors",
                  channel === c
                    ? "border-transparent text-background"
                    : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
                style={channel === c ? { backgroundImage: WARM_GRADIENT } : undefined}
                aria-label={META[c].label}
              >
                <Icon className="size-3" />
              </button>
            );
          })}
        </div>
      </div>

      {channel === "email" && (
        <div className="mb-1.5 border-b border-white/5 pb-1.5 font-mono text-[11px] text-foreground/60">
          subject: <span className="text-foreground/80">{prospect.draft.subject}</span>
        </div>
      )}
      <p className="min-h-[3.5rem] text-[12.5px] leading-relaxed text-foreground/85">
        {display}
        {shouldType && display.length < draftBody.length && (
          <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-foreground/70 align-middle" />
        )}
      </p>
    </motion.div>
  );
}

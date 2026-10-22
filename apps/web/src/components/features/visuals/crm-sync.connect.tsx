"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CRM, CRMS, DESTS, DestTile, DoneChip, EASE, ROW } from "./crm-sync.parts";

/* The first step's picture, a client module: HubSpot gets authorized as the step scrolls
   in, once; under reduced motion it's shown connected. */

function Authorize({ primary = false }: { primary?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[0.65rem] font-semibold",
        primary
          ? "bg-[var(--fb)] text-white shadow-[0_1px_2px_rgba(4,24,72,0.2)]"
          : "border border-[rgba(12,16,26,0.12)] bg-white text-foreground",
      )}
    >
      Authorize
    </span>
  );
}

/** 1 — Connect your CRM: the three CRMs, and HubSpot authorized as the step scrolls in. */
export function ConnectStep() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion() ?? false;
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setTimeout(() => setAuthorized(true), 1100);
    return () => window.clearTimeout(id);
  }, [inView, reduce]);

  const connected = reduce || authorized;

  return (
    <div ref={ref} className="space-y-2">
      {CRMS.map((id) => (
        <div key={id} className={ROW}>
          <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
            <DestTile id={id} />
            <span className="truncate">{DESTS[id].name}</span>
          </span>
          {id === CRM ? (
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={connected ? "connected" : "authorize"}
                className="inline-flex"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {connected ? <DoneChip>Connected</DoneChip> : <Authorize primary />}
              </motion.span>
            </AnimatePresence>
          ) : (
            <Authorize />
          )}
        </div>
      ))}
    </div>
  );
}

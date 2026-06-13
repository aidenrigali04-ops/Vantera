"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export interface WalkStep {
  anchor: string;
  note: string;
}

export function Walkthrough({
  steps,
  onClose,
}: {
  steps: WalkStep[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step: WalkStep | undefined = steps[i];

  useEffect(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(
      `[data-copilot="${step.anchor}"]`,
    );
    if (!el) {
      // anchor not on this page — defer skip/close to avoid synchronous setState-in-effect
      const id = setTimeout(() => {
        if (i < steps.length - 1) {
          setI(i + 1);
        } else {
          onClose();
        }
      }, 0);
      return () => clearTimeout(id);
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [i, step, steps.length, onClose]);

  if (!step || !rect) return null;

  const tooltipLeft = Math.max(
    8,
    Math.min(rect.left, window.innerWidth - 280),
  );

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* Dim overlay with a cutout ring around the target element */}
      <div
        className="absolute rounded-lg ring-2 ring-primary ring-offset-2 transition-all"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
        }}
      />
      {/* Tooltip */}
      <div
        className="absolute max-w-xs rounded-xl border bg-background p-3 text-sm shadow-lg"
        style={{ top: rect.bottom + 8, left: tooltipLeft }}
      >
        <p>{step.note}</p>
        <div className="mt-2 flex justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Skip
          </Button>
          <Button
            size="sm"
            onClick={() =>
              i < steps.length - 1 ? setI(i + 1) : onClose()
            }
          >
            {i < steps.length - 1 ? "Next" : "Done"}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * R2: the ONE confirmation idiom for irreversible actions (audit: three incompatible
 * idioms + several one-click irreversibles). Hand-rolled — the repo carries no radix;
 * portal to <body> so no overflow container can clip it (the notifications-bell lesson).
 *
 * Type-to-confirm (workspace delete) and inline-reveal (GDPR erase) stay as-is — they
 * are deliberately heavier.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  trigger,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  /** render-prop so the trigger keeps the call site's exact styling */
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      {trigger(() => setOpen(true))}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] grid place-items-center bg-black/30 p-4"
            onClick={close}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby="confirm-desc"
              className="w-full max-w-sm rounded-xl border border-[var(--hairline)] bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="confirm-title" className="text-base font-semibold text-foreground">
                {title}
              </h2>
              <p id="confirm-desc" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button ref={cancelRef} type="button" size="sm" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={destructive ? "destructive" : "default"}
                  onClick={() => {
                    close();
                    onConfirm();
                  }}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

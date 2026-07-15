"use client";

import { Toaster as Sonner } from "sonner";

/**
 * R1b: the app's single feedback layer. Top-right — bottom-right belongs to the copilot
 * pill, and mobile's bottom edge belongs to the MobileNav bar.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      offset={16}
      mobileOffset={{ top: 72 }}
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border border-[var(--hairline)] bg-white text-foreground shadow-lg",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
        },
      }}
    />
  );
}

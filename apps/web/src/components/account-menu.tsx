"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";

/**
 * T5: the identity chip becomes an account menu — name, email, Settings, sign out.
 * It was a dead <span> with an email tooltip; the display name users set in Settings
 * was never visible anywhere. Portal-free (anchored in the rail), Esc + outside-click
 * close, dock idiom preserved.
 */
export function AccountMenu({
  initial,
  displayName,
  email,
  signOut,
}: {
  initial: string;
  displayName: string | null;
  email: string;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="grid size-10 place-items-center rounded-full bg-[var(--nav-tile)] text-xs font-semibold text-[var(--nav-fg-strong)] ring-1 ring-[var(--nav-line)] transition-colors hover:bg-[var(--nav-tile-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-0 left-full z-50 ml-3 w-56 rounded-xl border border-[var(--hairline)] bg-white p-1.5 text-foreground shadow-2xl"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{displayName || "Set your display name"}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="my-1 border-t border-[var(--hairline)]" />
          <Link
            href="/settings"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--tint)]"
          >
            <Settings className="size-4 text-muted-foreground" /> Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--tint)]"
            >
              <LogOut className="size-4 text-muted-foreground" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

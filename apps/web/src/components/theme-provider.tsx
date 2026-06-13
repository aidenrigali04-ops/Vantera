"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Client wrapper around next-themes. Toggles the `.dark` class on <html>
 * (matches the `@custom-variant dark` + `.dark {}` token block in globals.css).
 * Vantera is light-first (brand default), with opt-in dark via the toggle —
 * system preference is intentionally not auto-applied.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

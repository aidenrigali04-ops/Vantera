"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "./vantera-logo";

const LINKS = [
  { label: "Product", href: "#features" },
  { label: "How it works", href: "#showcase" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3.5">
      <nav
        className={cn(
          "flex h-14 w-full max-w-5xl items-center rounded-full pl-5 pr-2 transition-all duration-300",
          scrolled
            ? "border border-[var(--hairline)] bg-white/75 shadow-[var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150"
            : "border border-transparent",
        )}
      >
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <VanteraLogo className="size-[22px] text-foreground" />
          <span className="text-[16.5px] font-semibold tracking-[-0.02em]">Vantera</span>
        </Link>

        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3.5 py-2 text-[14px] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-[14px] font-medium text-[var(--ink-2)] transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full bg-[#0a0c12] px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(12,16,26,0.2)] transition-all hover:shadow-[0_8px_24px_-8px_rgba(48,207,255,0.55)]"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "./vantera-logo";

const LINKS = [
  { label: "Product", href: "#difference" },
  { label: "How it works", href: "#how" },
  { label: "Agents", href: "#agents" },
  { label: "Pricing", href: "/pricing" },
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
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        scrolled ? "border-white/[0.08] bg-[#0a0b0d]/80 backdrop-blur-xl" : "border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center px-6 lg:px-8">
        {/* Logo — Vantera mark + wordmark */}
        <Link href="/" className="flex items-center gap-2.5">
          <VanteraLogo className="size-7 text-foreground" />
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground">Vantera</span>
        </Link>

        <ul className="ml-10 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/login"
            className="rounded-xl border border-white/15 px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground shadow-lg shadow-brand/25 transition-opacity hover:opacity-90"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}

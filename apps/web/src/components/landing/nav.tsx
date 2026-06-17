"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Why Vantera", href: "#difference" },
  { label: "How it works", href: "#how" },
  { label: "Agents", href: "#agents" },
  { label: "Outcomes", href: "#outcomes" },
  { label: "Pricing", href: "/pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center gap-4 rounded-2xl border px-3 py-2 transition-all duration-300 sm:px-4",
          scrolled
            ? "border-white/[0.16] bg-[#0b0c0f]/80 shadow-lg shadow-black/30 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="font-heading text-base font-semibold tracking-tight text-foreground">
          Vantera
        </Link>

        <ul className="ml-2 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-brand px-4 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

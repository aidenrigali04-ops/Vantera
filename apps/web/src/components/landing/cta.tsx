import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Landing CTAs — 2026 premium. Primary is a near-black pill that lifts and picks up a
 * faint cyan glow on hover; secondary is a clean white pill with a hairline border.
 * Renders <Link> for internal routes, <a> for mailto/anchors/external.
 */
function Anchor({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  if (internal) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

const BASE =
  "group/cta inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 will-change-transform";

export function PrimaryCta({
  href,
  children,
  className,
  size = "md",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <Anchor
      href={href}
      className={cn(
        BASE,
        "bg-[#0a0c12] text-white shadow-[0_1px_2px_rgba(12,16,26,0.2)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(11, 87, 171,0.55)]",
        size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-[14px]",
        className,
      )}
    >
      {children}
    </Anchor>
  );
}

export function SecondaryCta({
  href,
  children,
  className,
  size = "md",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <Anchor
      href={href}
      className={cn(
        BASE,
        "border border-[var(--hairline)] bg-white text-foreground shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:border-[rgba(12,16,26,0.16)]",
        size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-[14px]",
        className,
      )}
    >
      {children}
    </Anchor>
  );
}

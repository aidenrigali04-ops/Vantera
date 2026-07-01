import { cn } from "@/lib/utils";

/**
 * Page header for marketing subpages — matches LandingHeading's look (cyan-dot pill eyebrow +
 * Poppins title + grey subtitle) but renders an <h1> for correct per-page heading hierarchy.
 */
export function MarketingHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-1 text-[12.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)]",
            align === "center" && "mx-auto",
          )}
        >
          <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(11, 87, 171,0.8)]" />
          {eyebrow}
        </span>
      )}
      <h1 className="mt-5 text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[2.9rem] lg:text-[3.1rem]">
        {title}
      </h1>
      {subtitle && (
        <p
          className={cn(
            "mt-5 max-w-xl text-[16px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[17.5px]",
            align === "center" && "mx-auto",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

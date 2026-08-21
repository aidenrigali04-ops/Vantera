import { cn } from "@/lib/utils";

/**
 * Page header for marketing subpages — matches LandingHeading's look (quiet uppercase
 * accent eyebrow + Poppins title + grey subtitle) but renders an <h1> for correct
 * per-page heading hierarchy.
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
        <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
          {eyebrow}
        </span>
      )}
      <h1 className="mt-4 text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-[2.9rem] lg:text-[3.1rem]">
        {title}
      </h1>
      {subtitle && (
        <p
          className={cn(
            "mt-5 max-w-xl text-[16px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[17px]",
            align === "center" && "mx-auto",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

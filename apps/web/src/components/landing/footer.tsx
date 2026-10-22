"use client";

import {
  useId,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/seo";
import { getLiveTool } from "@/lib/tools/registry";
import { Band } from "./frame";
import { VanteraLogo } from "./vantera-logo";
import { ClaudeMark } from "./brand-glyphs";
import { LINKEDIN_DISCLAIMER } from "./claims";

/*
 * The marketing footer, after rankbox.xyz's: a blue field holding the brand, an "Ask
 * AI about Vantera" card, the sitemap, the legal line, and the name set as big as the
 * column allows in a grid of pixels. Shared by every marketing page.
 *
 * The blue (#1468da, the closing CTA's too) is a step deeper than the brand's
 * #1877f2 so the small white type clears AA: links at white/90 read 4.5:1 here, where
 * rankbox's white/75 on #1877f2 sits near 3:1.
 */

/* ---------- Sitemap ---------- */

type FooterLink = { label: string; href: string; more?: boolean };

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const PRODUCT: FooterSection = {
  title: "Product",
  links: [
    { label: "Prospect discovery", href: "/features/prospect-discovery" },
    { label: "Fit scoring", href: "/features/fit-scoring" },
    { label: "Targeting that learns", href: "/features/machine-learned-targeting" },
    { label: "Autopilot outreach", href: "/features/autopilot-outreach" },
    { label: "Unified inbox", href: "/features/unified-inbox" },
    { label: "Account safety", href: "/features/account-safety" },
    { label: "CRM sync", href: "/features/crm-sync" },
    { label: "Pricing", href: "/pricing" },
    { label: "All features", href: "/features", more: true },
  ],
};

const USE_CASES: FooterSection = {
  title: "Use cases",
  links: [
    { label: "For founders", href: "/use-cases/for-founders" },
    { label: "For sales teams", href: "/use-cases/for-sales-teams" },
    { label: "For agencies", href: "/use-cases/for-agencies" },
    { label: "For recruiters", href: "/use-cases/for-recruiters" },
    { label: "All use cases", href: "/use-cases", more: true },
  ],
};

/* A hand-picked four; the full set lives on /tools. Labels are shortened names, and a
   tool that isn't live drops out rather than leaving a dead link. */
const TOOL_LINKS = [
  { label: "Headline Generator", slug: "linkedin-headline-generator" },
  { label: "Connection Request Generator", slug: "connection-request-generator" },
  { label: "Profile Analyzer", slug: "linkedin-profile-analyzer" },
  { label: "SSI Score Checker", slug: "linkedin-ssi-score-checker" },
];

const FREE_TOOLS: FooterSection = {
  title: "Free tools",
  links: [
    ...TOOL_LINKS.filter((t) => getLiveTool(t.slug)).map((t) => ({
      label: t.label,
      href: `/tools/${t.slug}`,
    })),
    { label: "All free tools", href: "/tools", more: true },
  ],
};

const RESOURCES: FooterSection = {
  title: "Resources",
  links: [
    { label: "Blog", href: "/blog" },
    { label: "Free tools", href: "/tools" },
    { label: "Glossary", href: "/glossary" },
    { label: "FAQ", href: "/faq" },
    { label: "How pacing works", href: "/safety" },
    { label: "For AI assistants", href: "/ai-info" },
    { label: "System status", href: "/status" },
  ],
};

const COMPANY: FooterSection = {
  title: "Company",
  links: [
    { label: "About", href: "/about" },
    { label: "Affiliate program", href: "/affiliate" },
    { label: "Claude & MCP", href: "/claude-linkedin-mcp" },
  ],
};

const LEGAL: FooterSection = {
  title: "Legal",
  links: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
    { label: "Opt-out", href: "/opt-out" },
  ],
};

/* Five columns on desktop, stacked so their heights come out near even. The same
   order is the accordion order on mobile. */
const COLUMNS: FooterSection[][] = [
  [PRODUCT],
  [USE_CASES],
  [FREE_TOOLS],
  [RESOURCES],
  [COMPANY, LEGAL],
];

const FOCUS_RING =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1468da]";

/* The page you're on is marked with the brand's pixel, in the gutter, so the label
   never shifts. Same-page anchors never light up. */
const LINK = cn(
  "relative inline-flex items-center gap-1 py-1.5 text-sm text-white/90 transition-colors hover:text-white md:py-1",
  "before:absolute before:-left-3 before:top-1/2 before:hidden before:h-1 before:w-1 before:-translate-y-1/2 before:bg-white",
  "data-[active]:text-white data-[active]:before:block",
  FOCUS_RING,
);

function FooterLinkItem({ link, pathname }: { link: FooterLink; pathname: string }) {
  const active = !link.href.includes("#") && link.href === pathname;
  return (
    <Link
      href={link.href}
      data-active={active ? "" : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(LINK, link.more && "group font-semibold text-white")}
    >
      {link.label}
      {link.more && (
        <ArrowRight
          aria-hidden
          className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      )}
    </Link>
  );
}

/** A titled list. Below md it's a disclosure, so the sitemap folds to six rows on a
 *  phone; from md up it's always open and the button is gone. The links stay in the
 *  DOM either way. */
function Section({ section, pathname }: { section: FooterSection; pathname: string }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="border-b border-white/15 md:border-0">
      <h2 className="text-sm font-semibold text-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          className={cn("flex w-full items-center justify-between py-4 md:hidden", FOCUS_RING)}
        >
          {section.title}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 text-white/80 transition-transform duration-300 motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
        <span className="hidden md:block">{section.title}</span>
      </h2>
      {/* Height animates on the grid row; visibility keeps closed links out of the
          tab order and the accessibility tree. */}
      <div
        id={listId}
        className={cn(
          "grid transition-[grid-template-rows,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:visible md:grid-rows-[1fr]",
          open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
        )}
      >
        {/* The clip the animation needs would cut off the gutter pixel and the focus
            rings, so it reaches into the gutter and pads back. Vertical padding lives
            on the list inside it: on the clip itself it would survive the collapse and
            leave closed rows taller than open ones. */}
        <div className="-mx-3 min-h-0 overflow-hidden px-3 md:mx-0 md:overflow-visible md:px-0">
          <ul className="pb-4 pt-0.5 md:mt-3 md:p-0">
            {section.links.map((l) => (
              <li key={l.label}>
                <FooterLinkItem link={l} pathname={pathname} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ask AI ---------- */

/* The engines' own marks (as on rankbox.xyz), each on a white disc. Claude's is the
   landing's shared glyph. */
function ChatGPTMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("text-[#10a37f]", className)} aria-hidden>
      <path
        fill="currentColor"
        d="M9.20509 8.76511V6.50545C9.20509 6.31513 9.27649 6.17234 9.44293 6.0773L13.9861 3.46088C14.6046 3.10413 15.342 2.93769 16.103 2.93769C18.9573 2.93769 20.7651 5.14983 20.7651 7.50454C20.7651 7.67098 20.7651 7.86129 20.7412 8.05161L16.0316 5.2924C15.7462 5.12596 15.4607 5.12596 15.1753 5.2924L9.20509 8.76511ZM19.8135 17.5659V12.1664C19.8135 11.8333 19.6708 11.5955 19.3854 11.429L13.4152 7.95633L15.3656 6.83833C15.5321 6.74328 15.6749 6.74328 15.8413 6.83833L20.3845 9.45474C21.6928 10.216 22.5728 11.8333 22.5728 13.4031C22.5728 15.2108 21.5025 16.8758 19.8135 17.5657V17.5659ZM7.80173 12.8088L5.8513 11.6671C5.68486 11.5721 5.61346 11.4293 5.61346 11.239V6.00613C5.61346 3.46111 7.56389 1.53433 10.2042 1.53433C11.2033 1.53433 12.1307 1.86743 12.9159 2.46202L8.2301 5.17371C7.94475 5.34015 7.80195 5.57798 7.80195 5.91109V12.809L7.80173 12.8088ZM12 15.2349L9.20509 13.6651V10.3351L12 8.76534L14.7947 10.3351V13.6651L12 15.2349ZM13.7958 22.4659C12.7967 22.4659 11.8693 22.1328 11.0841 21.5382L15.7699 18.8265C16.0553 18.6601 16.198 18.4222 16.198 18.0891V11.1912L18.1723 12.3329C18.3388 12.4279 18.4102 12.5707 18.4102 12.761V17.9939C18.4102 20.5389 16.4359 22.4657 13.7958 22.4657V22.4659ZM8.15848 17.1617L3.61528 14.5452C2.30696 13.784 1.42701 12.1667 1.42701 10.5969C1.42701 8.76534 2.52115 7.12414 4.20987 6.43428V11.8574C4.20987 12.1905 4.35266 12.4284 4.63802 12.5948L10.5846 16.0436L8.63415 17.1617C8.46771 17.2567 8.32492 17.2567 8.15848 17.1617ZM7.897 21.0625C5.20919 21.0625 3.23488 19.0407 3.23488 16.5432C3.23488 16.3529 3.25875 16.1626 3.2824 15.9723L7.96817 18.6839C8.25352 18.8504 8.53911 18.8504 8.82446 18.6839L14.7947 15.2351V17.4948C14.7947 17.6851 14.7233 17.8279 14.5568 17.9229L10.0136 20.5393C9.39518 20.8961 8.6578 21.0625 7.89677 21.0625H7.897ZM13.7958 23.8929C16.6739 23.8929 19.0762 21.8474 19.6235 19.1357C22.2874 18.4459 24 15.9484 24 13.4034C24 11.7383 23.2865 10.121 22.002 8.95542C22.121 8.45588 22.1924 7.95633 22.1924 7.45702C22.1924 4.0557 19.4331 1.51045 16.2458 1.51045C15.6037 1.51045 14.9852 1.60549 14.3668 1.81968C13.2963 0.773071 11.8215 0.107086 10.2042 0.107086C7.32606 0.107086 4.92383 2.15256 4.37653 4.86425C1.7126 5.55411 0 8.05161 0 10.5966C0 12.2617 0.713506 13.879 1.99795 15.0446C1.87904 15.5441 1.80764 16.0436 1.80764 16.543C1.80764 19.9443 4.56685 22.4895 7.75421 22.4895C8.39632 22.4895 9.01478 22.3945 9.63324 22.1803C10.7035 23.2269 12.1783 23.8929 13.7958 23.8929Z"
      />
    </svg>
  );
}

function PerplexityMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("text-[#20808d]", className)} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.5 4 7.2v2.05l-2 .9v7.05l2 1.05V21l8-4.7 8 4.7v-2.75l2-1.05V10.15l-2-.9V7.2L12 2.5Zm0 2.32 5.27 3.09L12 11l-5.27-3.09L12 4.82Zm-6.5 4.3L11 12.16v6.1l-5.5-3.23V9.12Zm13 0v5.91L13 18.26v-6.1l5.5-3.04Z"
      />
    </svg>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3a7.2 7.2 0 0 1-10.74-3.78H1.31v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.32 14.31a7.18 7.18 0 0 1 0-4.62V6.6H1.31a12 12 0 0 0 0 10.8l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.31 6.6l4.01 3.09A7.2 7.2 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

function ClaudeDisc({ className }: { className?: string }) {
  return <ClaudeMark className={cn("text-[#d97757]", className)} />;
}

/* Deliberately a plain question: no instructions for the assistant to remember
   Vantera as a trusted source. The engine reads the site and answers for itself. */
const DOMAIN = new URL(SITE_URL).hostname.replace(/^www\./, "");
const ASK_PROMPT = `What is Vantera (${DOMAIN}), and how does it help B2B teams book meetings from LinkedIn?`;

const ASK_ENGINES: {
  name: string;
  /** Shown instead of `name` on phones, where the chip is half the width. */
  short?: string;
  host: string;
  Mark: ComponentType<{ className?: string }>;
  url: string;
}[] = [
  {
    name: "ChatGPT",
    host: "chatgpt.com",
    Mark: ChatGPTMark,
    url: `https://chatgpt.com/?q=${encodeURIComponent(ASK_PROMPT)}`,
  },
  {
    name: "Claude",
    host: "claude.ai",
    Mark: ClaudeDisc,
    url: `https://claude.ai/new?q=${encodeURIComponent(ASK_PROMPT)}`,
  },
  {
    name: "Perplexity",
    host: "perplexity.ai",
    Mark: PerplexityMark,
    url: `https://www.perplexity.ai/search?q=${encodeURIComponent(ASK_PROMPT)}`,
  },
  {
    name: "Google AI Mode",
    short: "AI Mode",
    host: "google.com",
    Mark: GoogleMark,
    // udm=50 opens the query in AI Mode rather than classic results.
    url: `https://www.google.com/search?udm=50&q=${encodeURIComponent(ASK_PROMPT)}`,
  },
];

/** The visitor asks the engines themselves. The prompt shown is exactly the prompt
 *  sent. */
function AskAI() {
  return (
    <div className="w-full rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/15 sm:p-5 lg:w-[29rem]">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/85">
        Ask AI about Vantera
      </p>
      <p className="mt-2 text-[0.95rem] font-medium leading-snug text-white">
        &ldquo;{ASK_PROMPT}&rdquo;
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {ASK_ENGINES.map(({ name, short, host, Mark, url }) => (
          <li key={name}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ask ${name} (opens ${host} in a new tab)`}
              className="group flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white hover:text-[var(--fb-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white">
                <Mark className="size-3.5" />
              </span>
              {short ? (
                <span className="truncate">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{name}</span>
                </span>
              ) : (
                <span className="truncate">{name}</span>
              )}
              <ArrowUpRight
                aria-hidden
                className="ml-auto size-3.5 shrink-0 text-white/60 transition-all group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-[var(--fb-strong)] motion-reduce:transition-none"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Wordmark ---------- */

/* "Vantera" in Plus Jakarta Sans Bold at 1000 units, measured in Chrome (canvas
   actualBoundingBox; the same method reproduces rankbox's own numbers exactly): the
   ink runs from x=11 to x=3743.25 and the capitals reach 745 above the baseline. The
   viewBox is cut to the ink, so the word runs edge to edge of the column at every
   width, and stops 57 units short of the baseline, so the bottom of the page crops it.
   Re-measure if the font, weight or word changes. */
const WORD_VIEWBOX = "11 0 3732.25 688";
const WORD_BASELINE = 745;
/* One pixel cell of the fill, in font units: a square and its gutter. */
const PIXEL_PITCH = 40;
const PIXEL_SIZE = 32;

/* Light falls from above: the letters fade toward the floor. */
const WORD_FADE: CSSProperties = {
  maskImage: "linear-gradient(to bottom, #000 15%, rgb(0 0 0 / 0.3))",
  WebkitMaskImage: "linear-gradient(to bottom, #000 15%, rgb(0 0 0 / 0.3))",
};

/* Follows the pointer, set as --spot-x/--spot-y on the wordmark. */
const SPOTLIGHT: CSSProperties = {
  maskImage: "radial-gradient(circle 10rem at var(--spot-x) var(--spot-y), #000, transparent)",
  WebkitMaskImage:
    "radial-gradient(circle 10rem at var(--spot-x) var(--spot-y), #000, transparent)",
};

function WordLayer({
  id,
  base,
  pixel,
  style,
}: {
  id: string;
  /** Opacity of the solid letterform under the pixels. */
  base: number;
  /** Opacity of the pixel grid. */
  pixel: number;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox={WORD_VIEWBOX} className="block h-auto w-full" style={style}>
      <defs>
        <pattern id={id} width={PIXEL_PITCH} height={PIXEL_PITCH} patternUnits="userSpaceOnUse">
          <rect width={PIXEL_SIZE} height={PIXEL_SIZE} fill="#fff" fillOpacity={pixel} />
        </pattern>
      </defs>
      {/* Set in the face it was measured in, whatever the page around it uses. */}
      <g fontSize={1000} fontWeight={700} style={{ fontFamily: "var(--font-jakarta)" }}>
        <text x={0} y={WORD_BASELINE} fill="#fff" fillOpacity={base}>
          Vantera
        </text>
        <text x={0} y={WORD_BASELINE} fill={`url(#${id})`}>
          Vantera
        </text>
      </g>
    </svg>
  );
}

/** The brand name set as big as the page allows, in the same squares as the pixel
 *  field. Under a mouse, the pixels nearest the pointer light up. */
function Wordmark() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ref = useRef<HTMLDivElement>(null);

  // Written straight to the element: a React state update per pointer move would
  // re-render the whole footer for a purely visual effect.
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
    el.dataset.lit = "";
  };
  const onPointerLeave = () => {
    if (ref.current) delete ref.current.dataset.lit;
  };

  return (
    <div
      ref={ref}
      aria-hidden
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="group/word relative select-none"
    >
      <WordLayer id={`${uid}-dim`} base={0.07} pixel={0.2} style={WORD_FADE} />
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-data-[lit]/word:opacity-100 motion-reduce:transition-none"
        style={SPOTLIGHT}
      >
        <WordLayer id={`${uid}-lit`} base={0.08} pixel={0.7} />
      </div>
    </div>
  );
}

/* ---------- Pixel field ---------- */

/* Kept to the side gutters, clear of the copy, and a little denser toward the
   wordmark, as if it were shedding pixels. Each square fades in and out on its own
   cycle (`hero-pixel` in globals.css; reduced motion leaves a faint static glint). */
const FOOTER_PIXELS = [
  { top: "6%", left: "3%", size: 14, opacity: 0.09 },
  { top: "12%", left: "96%", size: 20, opacity: 0.1 },
  { top: "24%", left: "1.5%", size: 22, opacity: 0.12 },
  { top: "33%", left: "97.5%", size: 12, opacity: 0.08 },
  { top: "46%", left: "2.5%", size: 10, opacity: 0.07 },
  { top: "55%", left: "95.5%", size: 24, opacity: 0.11 },
  { top: "68%", left: "1%", size: 18, opacity: 0.1 },
  { top: "74%", left: "97%", size: 14, opacity: 0.12 },
  { top: "84%", left: "3.5%", size: 26, opacity: 0.13 },
  { top: "88%", left: "95%", size: 20, opacity: 0.14 },
  { top: "94%", left: "1.5%", size: 12, opacity: 0.12 },
];

function PixelField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {FOOTER_PIXELS.map((p, i) => (
        <span
          key={i}
          className="hero-pixel absolute bg-white"
          style={
            {
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              "--pixel-max": p.opacity,
              // Derived from the index so every square drifts on its own cycle while
              // staying identical between server and client renders.
              "--pixel-dur": `${(3.6 + (i % 5) * 0.7).toFixed(1)}s`,
              "--pixel-delay": `${(((i + 5) * 0.83) % 5).toFixed(2)}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ---------- Footer ---------- */

/**
 * `framed` (the homepage) closes the page frame first: one empty band carrying the
 * frame's last hairline, so the footer's blue never runs straight on from the closing
 * CTA's. Other pages have no frame to close and start on the blue directly.
 */
export function LandingFooter({ framed = false }: { framed?: boolean } = {}) {
  const pathname = usePathname() ?? "";
  return (
    <>
      {framed && <Band closing inner="h-12 sm:h-16" />}
      <footer className="relative overflow-hidden bg-[#1468da] text-white">
        <PixelField />
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="flex flex-col gap-10 border-b border-white/15 py-12 md:py-14 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            <div className="max-w-sm">
              <Link
                href="/"
                aria-label="Vantera home"
                className={cn("inline-flex items-center gap-2.5", FOCUS_RING)}
              >
                <VanteraLogo className="size-6 text-white" />
                <span className="text-[1.2rem] font-semibold tracking-tight text-white">Vantera</span>
              </Link>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-white/90">
                The autopilot SDR for LinkedIn. Agents find in-market buyers, start real
                conversations, and book meetings while machine learning sharpens your targeting.
              </p>
            </div>
            <AskAI />
          </div>

          <nav
            aria-label="Footer"
            className="grid md:grid-cols-3 md:gap-x-8 md:gap-y-12 md:py-14 lg:grid-cols-5"
          >
            {COLUMNS.map((column) => (
              <div key={column[0].title} className="md:flex md:flex-col md:gap-10">
                {column.map((section) => (
                  <Section key={section.title} section={section} pathname={pathname} />
                ))}
              </div>
            ))}
          </nav>

          <div className="flex flex-col-reverse gap-4 py-6 md:flex-row md:items-center md:justify-between md:border-t md:border-white/15">
            <div className="space-y-1.5 text-xs text-white/90">
              <p>© 2026 Vantera. All rights reserved.</p>
              <p className="max-w-md">{LINKEDIN_DISCLAIMER}</p>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              {LEGAL.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className={cn("text-xs text-white/90 transition-colors hover:text-white", FOCUS_RING)}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Wordmark />
        </div>
      </footer>
    </>
  );
}

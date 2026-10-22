import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Building2,
  CalendarCheck,
  Gauge,
  HelpCircle,
  LayoutGrid,
  MessagesSquare,
  Newspaper,
  Radar,
  RefreshCw,
  Rocket,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundSearch,
  Users,
  Wrench,
} from "lucide-react";
import { McpIcon, type ProductIcon } from "./product-icons";

/**
 * Mega-menu content. Split from nav.tsx so the bar stays readable and this stays a
 * pure data file — every href points at a route that exists (see src/app), never a
 * placeholder. White-label rule (03/04/05): no vendor names; LinkedIn and Claude/MCP
 * are the only third parties named anywhere on the marketing site.
 */

export type MenuItem = {
  icon: ProductIcon | typeof Users;
  title: string;
  desc: string;
  href: string;
};

export type MenuColumn = {
  /** Small grey label above the column. */
  eyebrow: string;
  items: MenuItem[];
};

/** The right rail: a heading, a line of copy, and a sample card with the way in. */
export type MenuFeature = {
  title: string;
  blurb: string;
  readout: { label: string; rows: { k: string; v: string }[]; note: string };
  cta: { label: string; href: string };
};

/** The strip along the panel's foot: a lead link on the left, a "see all" on the right.
    `marks` shows the integration glyphs in front of the lead. */
export type MenuFooter = {
  lead: { label: string; text: string; href: string; marks?: boolean };
  more: { label: string; href: string };
};

export type Menu = {
  key: string;
  label: string;
  columns: [MenuColumn, MenuColumn];
  feature: MenuFeature;
  footer: MenuFooter;
};

export const MENUS: Menu[] = [
  {
    key: "platform",
    label: "Platform",
    columns: [
      {
        eyebrow: "Find buyers",
        items: [
          {
            icon: Radar,
            title: "Prospect discovery",
            desc: "Your ICP, searched on a schedule",
            href: "/features/prospect-discovery",
          },
          {
            icon: ScanSearch,
            title: "Fit scoring",
            desc: "Every prospect scored, math shown",
            href: "/features/fit-scoring",
          },
          {
            icon: BrainCircuit,
            title: "Targeting that learns",
            desc: "Sharper targeting every week",
            href: "/features/machine-learned-targeting",
          },
          {
            icon: Gauge,
            title: "How it works",
            desc: "Set up in 3 minutes, then autopilot",
            href: "/#how-it-works",
          },
        ],
      },
      {
        eyebrow: "Book meetings",
        items: [
          {
            icon: Send,
            title: "Autopilot outreach",
            desc: "Openers written from real activity",
            href: "/features/autopilot-outreach",
          },
          {
            icon: MessagesSquare,
            title: "Unified inbox",
            desc: "Every reply, answered on autopilot",
            href: "/features/unified-inbox",
          },
          {
            icon: ShieldCheck,
            title: "Account safety",
            desc: "Hard ceilings, human pacing",
            href: "/features/account-safety",
          },
          {
            icon: RefreshCw,
            title: "CRM sync",
            desc: "Won conversations, straight to your CRM",
            href: "/features/crm-sync",
          },
        ],
      },
    ],
    feature: {
      title: "Claude & MCP",
      blurb: "Drive your whole pipeline from Claude — the same agents, in your chat window.",
      readout: {
        label: "MCP tools",
        rows: [
          { k: "find_prospects", v: "ready" },
          { k: "draft_outreach", v: "ready" },
          { k: "book_meeting", v: "ready" },
        ],
        note: "connect once · the same agents, on autopilot",
      },
      cta: { label: "Set up MCP", href: "/claude-linkedin-mcp" },
    },
    footer: {
      lead: {
        label: "Integrations",
        text: "Wins land in HubSpot, Salesforce, or GoHighLevel; run Vantera from Claude",
        href: "/claude-linkedin-mcp",
        marks: true,
      },
      more: { label: "All features", href: "/features" },
    },
  },
  {
    key: "solutions",
    label: "Solutions",
    columns: [
      {
        eyebrow: "By role",
        items: [
          {
            icon: Users,
            title: "Sales teams",
            desc: "Pipeline without more headcount",
            href: "/use-cases/for-sales-teams",
          },
          {
            icon: Rocket,
            title: "Founders",
            desc: "Your first repeatable channel",
            href: "/use-cases/for-founders",
          },
          {
            icon: Building2,
            title: "Agencies",
            desc: "Every client, one dashboard",
            href: "/use-cases/for-agencies",
          },
          {
            icon: UserRoundSearch,
            title: "Recruiters",
            desc: "Reach candidates who reply",
            href: "/use-cases/for-recruiters",
          },
        ],
      },
      {
        eyebrow: "By outcome",
        items: [
          {
            icon: CalendarCheck,
            title: "More booked calls",
            desc: "How teams turn LinkedIn into meetings",
            href: "/case-studies",
          },
          {
            icon: BookOpen,
            title: "Proven playbooks",
            desc: "Campaigns you can copy today",
            href: "/playbooks",
          },
          {
            icon: Target,
            title: "Only qualified leads",
            desc: "The bar every prospect clears",
            href: "/#evidence",
          },
          {
            icon: LayoutGrid,
            title: "All use cases",
            desc: "Browse every scenario",
            href: "/use-cases",
          },
        ],
      },
    ],
    feature: {
      title: "Built for the reply",
      blurb: "Agents qualify first and write from activity, so the conversations you get are real.",
      readout: {
        label: "Typical week",
        rows: [
          { k: "Qualified", v: "180" },
          { k: "Replied", v: "31" },
          { k: "Booked", v: "24" },
        ],
        note: "illustrative · your numbers depend on your ICP",
      },
      cta: { label: "See case studies", href: "/case-studies" },
    },
    footer: {
      lead: { label: "Book a demo", text: "See Vantera run on your own ICP", href: "/demo" },
      more: { label: "All use cases", href: "/use-cases" },
    },
  },
  {
    key: "resources",
    label: "Resources",
    columns: [
      {
        eyebrow: "Learn",
        items: [
          {
            icon: Newspaper,
            title: "Blog",
            desc: "Tactics, teardowns, and data",
            href: "/blog",
          },
          {
            icon: BookOpen,
            title: "Glossary",
            desc: "Every term, explained plainly",
            href: "/glossary",
          },
          {
            icon: HelpCircle,
            title: "FAQ",
            desc: "Safety, pricing, and setup",
            href: "/faq",
          },
          {
            icon: Sparkles,
            title: "About",
            desc: "Why we built Vantera",
            href: "/about",
          },
        ],
      },
      {
        eyebrow: "Free tools",
        items: [
          {
            icon: McpIcon,
            title: "Headline generator",
            desc: "A profile that earns the click",
            href: "/tools/linkedin-headline-generator",
          },
          {
            icon: Send,
            title: "Connection requests",
            desc: "Notes people actually accept",
            href: "/tools/connection-request-generator",
          },
          {
            icon: Gauge,
            title: "Profile analyzer",
            desc: "Score your profile in seconds",
            href: "/tools/linkedin-profile-analyzer",
          },
          {
            icon: Wrench,
            title: "All free tools",
            desc: "Every generator, free to use",
            href: "/tools",
          },
        ],
      },
    ],
    feature: {
      title: "Free, no signup",
      blurb: "LinkedIn generators you can run right now — no account, no card.",
      readout: {
        label: "Most used",
        rows: [
          { k: "Headline", v: "free" },
          { k: "Cold outreach", v: "free" },
          { k: "Profile roaster", v: "free" },
        ],
        note: "run them anonymously · nothing is stored",
      },
      cta: { label: "Browse tools", href: "/tools" },
    },
    footer: {
      lead: { label: "Playbooks", text: "LinkedIn plays your agents can run this week", href: "/playbooks" },
      more: { label: "All free tools", href: "/tools" },
    },
  },
];

/** Nav entries with no dropdown. */
export const FLAT_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
];

export { ArrowRight };

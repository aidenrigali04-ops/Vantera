import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarCheck,
  Gauge,
  HelpCircle,
  Layers,
  LayoutGrid,
  Newspaper,
  Rocket,
  Send,
  Sparkles,
  Target,
  UserRoundSearch,
  Users,
  Wrench,
} from "lucide-react";
import {
  ControlIcon,
  CrmSyncIcon,
  McpIcon,
  OutreachIcon,
  ProspectingIcon,
  RepliesIcon,
  SafetyIcon,
  type ProductIcon,
} from "./product-icons";

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
  /** Small tracked-caps eyebrow above the column. */
  eyebrow: string;
  items: MenuItem[];
};

/** The third column: a tinted feature card with a mono-style readout. */
export type MenuFeature = {
  title: string;
  blurb: string;
  readout: { label: string; rows: { k: string; v: string }[]; note: string };
  cta: { label: string; href: string };
};

export type Menu = {
  key: string;
  label: string;
  columns: [MenuColumn, MenuColumn];
  feature: MenuFeature;
};

export const MENUS: Menu[] = [
  {
    key: "platform",
    label: "Platform",
    columns: [
      {
        eyebrow: "The agents",
        items: [
          {
            icon: ProspectingIcon,
            title: "Prospecting",
            desc: "Find and rank in-market buyers",
            href: "/#evidence",
          },
          {
            icon: OutreachIcon,
            title: "Outreach",
            desc: "Messages written from real activity",
            href: "/#approvals",
          },
          {
            icon: RepliesIcon,
            title: "Replies",
            desc: "Every reply captured in one place",
            href: "/#replies",
          },
          {
            icon: SafetyIcon,
            title: "Safety",
            desc: "LinkedIn-safe, anti-ban pacing",
            href: "/#safety",
          },
        ],
      },
      {
        eyebrow: "The platform",
        items: [
          {
            icon: ControlIcon,
            title: "Approvals",
            desc: "You approve before anything sends",
            href: "/#approvals",
          },
          {
            icon: CrmSyncIcon,
            title: "CRM sync",
            desc: "Closed deals pushed to your CRM",
            href: "/#replies",
          },
          {
            icon: Gauge,
            title: "How it works",
            desc: "The loop, end to end",
            href: "/#how-it-works",
          },
          {
            icon: Layers,
            title: "One tool, not six",
            desc: "What Vantera replaces",
            href: "/#compare",
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
        note: "connect once · your approval still gates every send",
      },
      cta: { label: "Set up MCP", href: "/claude-linkedin-mcp" },
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
            desc: "Real numbers from real accounts",
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
            desc: "14 generators, no signup",
            href: "/tools",
          },
        ],
      },
    ],
    feature: {
      title: "Free, no signup",
      blurb: "Fourteen LinkedIn generators you can run right now — no account, no card.",
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
  },
];

/** Nav entries with no dropdown. */
export const FLAT_LINKS = [{ label: "Pricing", href: "/pricing" }];

export { ArrowRight };

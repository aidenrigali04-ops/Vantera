import type { ComponentType, ReactNode } from "react";
import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ClaudeMark,
  HubSpotMark,
  SalesforceMark,
  SlackMark,
} from "@/components/landing/brand-glyphs";

/**
 * The CRM sync pictures' shared pieces: the sample cast, the destinations, and the
 * small rows and chips the screens are built from. No hooks, so the still screens in
 * crm-sync.tsx and the moving ones in crm-sync.live.tsx both draw from here.
 *
 * The facts are packages/crm-infra's. A closed win is pushed, on its own, to every
 * connected destination: HubSpot, Salesforce, or GoHighLevel get the contact (matched by
 * email when it's already there) and a won deal named "<company> — won"; Slack gets a
 * "Deal closed — …" message, and monday.com an item with the same text. Every person,
 * company, and amount is the landing's fictional cast.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/** A bordered line inside a screen, the landing's ScreenRow without its type. */
export const ROW =
  "flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2";

export type CrmId = "hubspot" | "salesforce" | "gohighlevel";
export type DestId = CrmId | "slack" | "monday" | "claude";

/** The sample workspace's CRM. A real one usually runs a single CRM, so every picture
    lands its wins in HubSpot and lists the other two as ready to connect. */
export const CRM: CrmId = "hubspot";

/** The CRMs a win can land in. */
export const CRMS: readonly CrmId[] = ["hubspot", "salesforce", "gohighlevel"];

type Dest = {
  name: string;
  /** A brand mark in the brand's colour, or a plain letter tile for marks we don't draw. */
  Mark?: ComponentType<{ className?: string }>;
  color?: string;
  letters?: string;
  dark?: boolean;
};

export const DESTS: Record<DestId, Dest> = {
  hubspot: { name: "HubSpot", Mark: HubSpotMark, color: "#ff5c35" },
  salesforce: { name: "Salesforce", Mark: SalesforceMark, color: "#00a1e0" },
  gohighlevel: { name: "GoHighLevel", letters: "GHL", dark: true },
  slack: { name: "Slack", Mark: SlackMark, color: "#4a154b" },
  monday: { name: "monday.com", letters: "M" },
  claude: { name: "Claude", Mark: ClaudeMark, color: "#d97757" },
};

/** One closed-won LinkedIn conversation. */
export interface Win {
  initials: string;
  name: string;
  role: string;
  company: string;
  tint: string;
  /** The prospect's last message before the deal closed. */
  last: string;
  value: string;
  /** False when the person was already in the CRM: matched by email, not created twice. */
  isNew: boolean;
}

export const WINS: Win[] = [
  {
    initials: "RN",
    name: "Rachel Nguyen",
    role: "VP Sales",
    company: "Northwind",
    tint: "#1877f2",
    last: "Let’s do it. Send the agreement over.",
    value: "$18,000",
    isNew: true,
  },
  {
    initials: "LR",
    name: "Luis Ramos",
    role: "Head of Sales",
    company: "Meridian",
    tint: "#0c9fce",
    last: "Signed on our side. Excited to start.",
    value: "$24,500",
    isNew: true,
  },
  {
    initials: "AO",
    name: "Aisha Okafor",
    role: "Founder",
    company: "Brightlane",
    tint: "#0f9d6e",
    last: "We’re in. Can we kick off Monday?",
    value: "$9,600",
    isNew: false,
  },
];

/** The won deal's name in the CRM. */
export const dealName = (w: Win) => `${w.company} — won`;
/** The Slack message and the monday.com item, word for word. */
export const dealMessage = (w: Win) => `Deal closed — ${w.name} (${w.company}): ${w.value}`;

export interface CrmRecord {
  kind: string;
  label: string;
  value?: string;
  status: string;
}

/** What a closed win writes to a CRM, in order: the contact, then the won deal (HubSpot
    calls it a deal; Salesforce and GoHighLevel, an opportunity). */
export function recordsFor(w: Win, crm: CrmId = CRM): CrmRecord[] {
  return [
    { kind: "Contact", label: w.name, status: w.isNew ? "Created" : "Matched" },
    {
      kind: crm === "hubspot" ? "Deal" : "Opportunity",
      label: dealName(w),
      value: w.value,
      status: "Closed won",
    },
  ];
}

export function Avatar({
  initials,
  tint,
  className,
}: {
  initials: string;
  tint: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: tint }}
    >
      {initials}
    </span>
  );
}

/** A destination on a small tile: its mark in its own colour, or its letters. The mark
    scales with the tile, so a className can size it. */
export function DestTile({ id, className }: { id: DestId; className?: string }) {
  const d = DESTS[id];
  if (d.letters) {
    return (
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md font-bold tracking-[-0.02em]",
          d.letters.length > 1 ? "text-[0.5rem]" : "text-[0.7rem]",
          d.dark
            ? "bg-[#1f2430] text-white"
            : "bg-white text-foreground ring-1 ring-inset ring-[rgba(12,16,26,0.1)]",
          className,
        )}
      >
        {d.letters}
      </span>
    );
  }
  const Mark = d.Mark!;
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md bg-white ring-1 ring-inset ring-[rgba(12,16,26,0.08)]",
        className,
      )}
      style={{ color: d.color }}
    >
      <Mark className="size-[58%]" />
    </span>
  );
}

/** Green: done, in sync, won. */
export function DoneChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#13824a]">
      <Check className="size-2.5" strokeWidth={3} />
      {children}
    </span>
  );
}

/** A green check on its own, where a row has no room for a chip. */
export function DoneDot() {
  return (
    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#e3f5ea] text-[#13824a]">
      <Check className="size-2.5" strokeWidth={3} />
    </span>
  );
}

/** The conversation's outcome: closed won, with the deal's value. */
export function WonChip({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-[#13824a]">
      <Trophy className="size-3" strokeWidth={2.4} />
      Closed won · {value}
    </span>
  );
}

/** A small "in sync" status with a green dot. */
export function SyncedMeta({ children = "Synced" }: { children?: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[0.68rem] font-medium text-[#13824a]">
      <span className="size-1.5 rounded-full bg-[#13824a]" />
      {children}
    </span>
  );
}

/** One record a win wrote: its kind, its name, and what happened to it. */
export function RecordRow({
  record,
  withValue = false,
}: {
  record: CrmRecord;
  /** Show the deal's value beside its name, where the row is wide enough. */
  withValue?: boolean;
}) {
  return (
    <div className={ROW}>
      <span className="flex min-w-0 items-center gap-2 text-xs">
        <span className="min-w-[3.25rem] shrink-0 text-[0.66rem] text-[var(--ink-3)]">{record.kind}</span>
        <span className="truncate font-medium text-foreground">{record.label}</span>
        {withValue && record.value && (
          <span className="shrink-0 text-[0.68rem] tabular-nums text-[var(--ink-3)]">{record.value}</span>
        )}
      </span>
      <DoneChip>{record.status}</DoneChip>
    </div>
  );
}

import { ArrowRight, BellRing, Lock, MessageSquareText, UserRoundPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveMeta, ScreenCard } from "@/components/landing/feature-row";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { ClaudeMark, LinkedinMark, McpMark } from "@/components/landing/brand-glyphs";
import type { FeatureVisuals } from "../types";
import {
  Avatar,
  CRM,
  CRMS,
  DESTS,
  DestTile,
  DoneChip,
  DoneDot,
  ROW,
  RecordRow,
  SyncedMeta,
  WINS,
  WonChip,
  dealMessage,
  dealName,
  recordsFor,
} from "./crm-sync.parts";
import { ConnectStep } from "./crm-sync.connect";
import { CrmSyncWindow } from "./crm-sync.window";

/**
 * /features/crm-sync's pictures, drawn the way the landing draws Vantera: white screens
 * with hairline borders, soft blue for what's moving, each destination in its own
 * colour. The window and the first step animate, so they live in crm-sync.window.tsx
 * and crm-sync.connect.tsx (client modules); this server module holds the still screens
 * and assembles the object the page's server sections read. The facts are
 * packages/crm-infra's (see crm-sync.parts.tsx); every person, company, and amount is
 * sample data.
 */

/* ---------- Benefit screens ---------- */

/* Three of the seven fields the defaults map, the same for every CRM. Email is the
   match key, so it can't be remapped. */
const FIELDS = [
  { from: "Email", to: "email", locked: true },
  { from: "Job title", to: "jobtitle", locked: false },
  { from: "Deal value", to: "amount", locked: false },
];

/** 01 — A contact and a deal for every closed win, mapped to your fields. */
function MappingScreen() {
  const win = WINS[0];
  return (
    <ScreenCard title={`Closed win · ${win.company}`} meta={<SyncedMeta />}>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[rgba(12,16,26,0.04)] p-1">
        {CRMS.map((id) => (
          <span
            key={id}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-md py-1 text-[0.68rem] font-medium",
              id === CRM
                ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                : "text-[var(--ink-3)]",
            )}
          >
            <DestTile id={id} className="hidden size-4 rounded-[4px] ring-0 sm:grid" />
            <span className="truncate">{DESTS[id].name}</span>
          </span>
        ))}
      </div>
      <div className="mt-2.5 space-y-2">
        {recordsFor(win).map((r) => (
          <RecordRow key={r.kind} record={r} withValue />
        ))}
      </div>
      <p className="mt-3.5 flex items-center justify-between text-[0.65rem] font-medium text-[var(--ink-3)]">
        Mapped to your fields
        <span className="tabular-nums">7 fields</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {FIELDS.map((f) => (
          <span
            key={f.from}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--hairline)] bg-white px-1.5 py-1 text-[0.66rem] text-foreground"
          >
            {f.from}
            <ArrowRight className="size-2.5 text-[var(--ink-4)]" />
            <span className="font-mono text-[0.62rem] text-[var(--fb-strong)]">{f.to}</span>
            {f.locked && <Lock className="size-2.5 text-[var(--ink-4)]" />}
          </span>
        ))}
      </div>
    </ScreenCard>
  );
}

/** 02 — The same win, posted to Slack and added to a monday.com board. */
function AlertsScreen() {
  const win = WINS[0];
  return (
    <ScreenCard title="Win alerts" meta={<LiveMeta>On every win</LiveMeta>}>
      {/* Slack: the message, as the app posts it */}
      <div className="rounded-lg border border-[var(--hairline)] bg-white p-3">
        <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold text-foreground">
          <DestTile id="slack" className="size-5" />
          #wins
        </p>
        <div className="mt-2.5 flex gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--fb)]">
            <VanteraLogo className="size-3.5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[0.68rem]">
              <span className="font-semibold text-foreground">Vantera</span>
              <span className="rounded-[3px] bg-[rgba(12,16,26,0.06)] px-1 py-px text-[0.55rem] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                App
              </span>
              <span className="tabular-nums text-[var(--ink-4)]">2:14 PM</span>
            </p>
            <p className="mt-0.5 text-[0.74rem] leading-snug text-foreground">{dealMessage(win)}</p>
          </div>
        </div>
      </div>
      {/* monday.com: an item on the board you chose */}
      <div className="mt-2 rounded-lg border border-[var(--hairline)] bg-white p-3">
        <p className="flex items-center justify-between gap-2 text-[0.7rem]">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <DestTile id="monday" className="size-5" />
            Closed deals
          </span>
          <span className="text-[0.62rem] text-[var(--ink-4)]">{DESTS.monday.name} board</span>
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md border-l-[3px] border-l-[var(--fb)] bg-[color-mix(in_oklab,var(--tint)_70%,white)] px-2.5 py-1.5">
          <span className="min-w-0 text-[0.72rem] font-medium leading-snug text-foreground">{dealMessage(win)}</span>
          <DoneChip>New item</DoneChip>
        </div>
      </div>
    </ScreenCard>
  );
}

const WARM = [
  { initials: "MF", name: "Marcus Feld", company: "Lumen", tint: "#5e6ad2", note: "Asked for pricing" },
  { initials: "PN", name: "Priya Nair", company: "Fieldnote", tint: "#c2557d", note: "Open to a call" },
];

/** 03 — Claude, connected over MCP, asked who's warm. */
function ClaudeScreen() {
  return (
    <ScreenCard
      title="Claude"
      meta={
        <span className="flex items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.62rem] font-medium text-[var(--ink-3)]">
          <McpMark className="size-3" />
          Vantera over MCP
        </span>
      }
    >
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-[12px] rounded-br-[4px] bg-[#f1f3f6] px-3 py-1.5 text-[0.74rem] text-foreground">
          {"Who’s warm this week?"}
        </p>
      </div>
      <div className="mt-3 flex gap-2.5">
        <ClaudeMark className="mt-0.5 size-4 shrink-0 text-[#d97757]" />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(12,16,26,0.04)] px-1.5 py-0.5 text-[0.62rem] font-medium text-[var(--ink-3)]">
            <McpMark className="size-3" />
            Used Vantera
          </span>
          <p className="mt-1.5 text-[0.74rem] leading-snug text-foreground">Two warm replies since Monday:</p>
          <div className="mt-2 space-y-1.5">
            {WARM.map((w) => (
              <div key={w.name} className={cn(ROW, "py-1.5")}>
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar initials={w.initials} tint={w.tint} className="size-5 text-[8px]" />
                  <span className="truncate text-[0.72rem] font-medium text-foreground">
                    {w.name}
                    <span className="font-normal text-[var(--ink-3)]"> · {w.company}</span>
                  </span>
                </span>
                <span className="shrink-0 text-[0.64rem] text-[var(--ink-3)]">{w.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenCard>
  );
}

/* ---------- Step pictures ---------- */

/** 2 — Win the conversation: the agent's last word, the yes, and the deal closed. */
function WinStep() {
  const win = WINS[1];
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[0.66rem] font-medium text-[var(--ink-3)]">
        <LinkedinMark className="size-3.5 shrink-0 text-[#0a66c2]" />
        <span className="truncate">
          {win.name} · {win.company}
        </span>
      </p>
      <p className="ml-auto w-fit max-w-[85%] rounded-[10px] rounded-br-[4px] bg-[var(--cyan-tint)] px-2.5 py-1.5 text-[0.72rem] leading-snug text-foreground ring-1 ring-inset ring-[rgba(22,111,229,0.16)]">
        Great. Sending the agreement now.
      </p>
      <p className="w-fit max-w-[85%] rounded-[10px] rounded-bl-[4px] bg-white px-2.5 py-1.5 text-[0.72rem] leading-snug text-foreground ring-1 ring-inset ring-[var(--hairline)]">
        {win.last}
      </p>
      <WonChip value={win.value} />
    </div>
  );
}

/** 3 — It lands as a deal: the contact and the deal in HubSpot, and the Slack message. */
function LandsStep() {
  const win = WINS[1];
  const rows = [
    { id: CRM, kind: "Contact", label: win.name },
    { id: CRM, kind: "Deal", label: dealName(win) },
    { id: "slack", kind: "#wins", label: "Deal closed" },
  ] as const;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.kind} className={ROW}>
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <DestTile id={r.id} className="size-5" />
            <span className="shrink-0 text-[0.66rem] text-[var(--ink-3)]">{r.kind}</span>
            <span className="truncate font-medium text-foreground">{r.label}</span>
          </span>
          <DoneDot />
        </div>
      ))}
    </div>
  );
}

/* ---------- The closing band's screen ---------- */

/** The top of the sync view, rising out of the closing band: recent wins, in sync. */
function CrmSyncPeek() {
  return (
    <div className="rounded-t-xl border border-b-0 border-white/20 bg-white p-4 text-left shadow-[0_-12px_48px_-16px_rgba(4,24,72,0.55)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-foreground">
          <VanteraLogo className="size-4 text-[var(--fb)]" />
          Wins in your CRM
        </span>
        <SyncedMeta>In sync</SyncedMeta>
      </div>
      <div className="mt-3.5 space-y-2">
        {WINS.map((w) => (
          <div key={w.name} className={ROW}>
            <span className="flex min-w-0 items-center gap-2">
              <Avatar initials={w.initials} tint={w.tint} className="size-6 text-[9px]" />
              <span className="truncate text-xs font-medium text-foreground">
                {w.name}
                <span className="font-normal text-[var(--ink-3)]"> · {w.company}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="hidden text-[0.68rem] tabular-nums text-[var(--ink-3)] sm:inline">{w.value}</span>
              <DestTile id={CRM} className="size-5" />
              <DoneChip>Contact + deal</DoneChip>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const visuals: FeatureVisuals = {
  Window: CrmSyncWindow,
  Peek: CrmSyncPeek,
  benefits: [MappingScreen, AlertsScreen, ClaudeScreen],
  benefitIcons: [UserRoundPlus, BellRing, MessageSquareText],
  steps: [ConnectStep, WinStep, LandsStep],
};

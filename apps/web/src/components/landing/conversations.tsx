import {
  Banknote,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarClock,
  FileText,
  Handshake,
  MessageCircle,
  MessagesSquare,
  Mic,
  MonitorPlay,
  Tag,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Band, CELL, CellGrid, LINE, SectionHead, type Icon } from "./frame";
import { Reveal, RevealItem } from "./surface";

/**
 * Sample conversations, after rankbox.xyz's "Founders already getting cited" grid:
 * six hairline cells, each one conversation an agent started. The signal it wrote
 * from (a post, a hire, a raise), the opener, the prospect's reply with the line
 * that matters underlined, where it led, and who replied.
 *
 * These are product samples, labelled as such in the header pill: the prospects and
 * replies show the shape of the output, not customer results. Each cell rises in on
 * its own as it scrolls into view (CSS reveal, visible without JS), staggered across
 * a row.
 */

type Conversation = {
  signal: string;
  signalIcon: Icon;
  /** The signal tile's icon colour (the landing's tone palette, frame.tsx). */
  signalTint: string;
  replied: string;
  opener: string;
  /** The reply, split around the phrase that gets underlined. */
  reply: [before: string, phrase: string, after: string];
  outcome: string;
  outcomeIcon: Icon;
  name: string;
  role: string;
  /** The prospect's avatar fill (white initials on top). */
  tint: string;
};

const CONVERSATIONS: Conversation[] = [
  {
    signal: "Post",
    signalIcon: FileText,
    signalTint: "#1461d1",
    replied: "Replied in 2h",
    opener:
      "Your post on rebuilding pipeline after the reorg stuck with me. Worth comparing notes?",
    reply: ["Yes — ", "this is exactly what we’re fixing", ". Free Thursday?"],
    outcome: "Meeting booked",
    outcomeIcon: CalendarCheck,
    name: "Rachel Nguyen",
    role: "VP Sales · Northwind",
    tint: "#1877f2",
  },
  {
    signal: "Hiring",
    signalIcon: UserPlus,
    signalTint: "#5b4bd1",
    replied: "Replied in 5h",
    opener: "Saw you’re hiring two SDRs. Teams at that stage usually hit a ramp gap first.",
    reply: ["Ha, ", "we’re living that right now", ". Send me a time."],
    outcome: "Meeting booked",
    outcomeIcon: CalendarCheck,
    name: "Marcus Feld",
    role: "Head of Growth · Lumen",
    tint: "#5e6ad2",
  },
  {
    signal: "Funding",
    signalIcon: Banknote,
    signalTint: "#13824a",
    replied: "Replied in 1d",
    opener:
      "Congrats on the seed round. Outbound is usually the first thing that slips after one.",
    reply: ["Timely. ", "Can you show me how it works?", ""],
    outcome: "Demo requested",
    outcomeIcon: MonitorPlay,
    name: "Aisha Okafor",
    role: "Founder · Brightlane",
    tint: "#0f9d6e",
  },
  {
    signal: "New role",
    signalIcon: BriefcaseBusiness,
    signalTint: "#a86500",
    replied: "Replied in 3h",
    opener:
      "Congrats on the new role. The first 90 days usually means rebuilding pipeline from scratch.",
    reply: ["It does. ", "Looping in our RevOps lead.", ""],
    outcome: "Intro to RevOps",
    outcomeIcon: Handshake,
    name: "Daniel Cho",
    role: "Sales Director · Summit Ridge",
    tint: "#0f766e",
  },
  {
    signal: "Comment",
    signalIcon: MessageCircle,
    signalTint: "#0c7fa6",
    replied: "Replied in 40m",
    opener:
      "Your comment on outbound tooling was spot on. Most teams still prospect by hand.",
    reply: ["", "We do, and it’s eating my week.", " Pricing for a team of 3?"],
    outcome: "Asked for pricing",
    outcomeIcon: Tag,
    name: "Luis Ramos",
    role: "Head of Sales · Meridian",
    tint: "#0c9fce",
  },
  {
    signal: "Event",
    signalIcon: Mic,
    signalTint: "#c0365a",
    replied: "Replied in 1d",
    opener:
      "Saw you’re speaking on founder-led sales next week. Would love your take on one thing.",
    reply: ["", "Happy to chat after the talk.", " Wednesday?"],
    outcome: "Call scheduled",
    outcomeIcon: CalendarClock,
    name: "Priya Nair",
    role: "COO · Fieldnote",
    tint: "#c2557d",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function SignalBadge({ c }: { c: Conversation }) {
  const SignalIcon = c.signalIcon;
  return (
    <span className="flex items-center gap-2 text-[0.8rem] font-medium text-foreground">
      <span
        className="flex size-6 items-center justify-center rounded-md border border-[rgba(12,16,26,0.08)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
        style={{ color: c.signalTint }}
      >
        <SignalIcon className="size-3.5" strokeWidth={2.2} />
      </span>
      {c.signal}
    </span>
  );
}

/* One conversation: what the prospect did, what the agent wrote, what came back,
   where it led, and who it was. Cells share hairlines rather than floating as cards,
   like Rankaria's grids. */
function ConversationCard({ c }: { c: Conversation }) {
  const OutcomeIcon = c.outcomeIcon;
  const [before, phrase, after] = c.reply;
  return (
    <article className="group flex h-full flex-col bg-white p-6 transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--tint)_35%,white)] sm:p-7">
      <div className="flex items-center justify-between gap-2">
        <SignalBadge c={c} />
        <span className="rounded-md border border-[var(--hairline)] bg-white px-2 py-0.5 text-[0.68rem] font-medium text-[var(--ink-3)]">
          {c.replied}
        </span>
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-[rgba(12,16,26,0.06)] bg-[color-mix(in_oklab,var(--tint)_70%,white)] p-3.5">
        {/* the agent's opener */}
        <p className="ml-auto w-fit max-w-[90%] rounded-lg border border-[rgba(12,16,26,0.07)] bg-white px-3 py-2 text-[0.8rem] leading-snug text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {c.opener}
        </p>
        {/* the prospect's reply, the line that matters underlined */}
        <p className="text-[0.8rem] leading-relaxed text-foreground/80">
          {before}
          <span className="font-semibold text-foreground underline decoration-[rgba(24,119,242,0.6)] decoration-2 underline-offset-[3px]">
            {phrase}
          </span>
          {after}
        </p>
      </div>

      <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-md bg-[var(--cyan-tint)] px-2 py-1 text-[0.75rem] font-semibold text-[var(--cyan-strong)]">
        <OutcomeIcon className="size-3.5" strokeWidth={2.2} />
        {c.outcome}
      </span>

      <div className={cn("mt-auto flex items-center gap-3 border-t pt-5", LINE)}>
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold text-white ring-2 ring-white"
          style={{ backgroundColor: c.tint }}
        >
          {initials(c.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
          <p className="truncate text-xs text-[var(--ink-3)]">{c.role}</p>
        </div>
      </div>
    </article>
  );
}

export function Conversations() {
  return (
    <section aria-label="Sample conversations">
      <SectionHead
        id="conversations"
        icon={MessagesSquare}
        eyebrow="Sample conversations"
        title={
          <>
            Openers that <Accent>start conversations</Accent>
          </>
        }
        subtitle="Every first message starts from something the buyer just did on LinkedIn: a post, a hire, a raise. Here’s what agents write, and what comes back."
      />
      <Band>
        <CellGrid className="md:grid-cols-2 lg:grid-cols-3">
          {CONVERSATIONS.map((c, i) => (
            <li key={c.name} className={CELL}>
              {/* Each cell reveals as it scrolls into view; the hairlines stay put and
                  only the card rises. The delay staggers the cells across a row. */}
              <Reveal className="h-full">
                <RevealItem className="h-full" style={{ transitionDelay: `${(i % 3) * 0.06}s` }}>
                  <ConversationCard c={c} />
                </RevealItem>
              </Reveal>
            </li>
          ))}
        </CellGrid>
      </Band>
    </section>
  );
}

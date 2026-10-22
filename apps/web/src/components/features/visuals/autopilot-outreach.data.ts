/**
 * Sample prospects for /features/autopilot-outreach's pictures: the site's fictional
 * cast (names, roles and avatar tints as the landing has them, and no one the other
 * pages show as opted out), each with the signal an opener was written from and the
 * opener itself. The `mark` part is the phrase the opener takes from the signal —
 * highlighted where it shows. In queue order: the window walks it once. Plain data,
 * shared by the client window and the server-rendered cards.
 */

export interface Part {
  text: string;
  mark?: boolean;
}

export interface Prospect {
  initials: string;
  name: string;
  role: string;
  tint: string;
  fit: number;
  signal: string;
  opener: Part[];
}

export const POOL: Prospect[] = [
  {
    initials: "MF",
    name: "Marcus Feld",
    role: "Head of Growth · Lumen",
    tint: "#5e6ad2",
    fit: 91,
    signal: "Hiring two SDRs · 6d",
    opener: [
      { text: "Saw Lumen is " },
      { text: "hiring two SDRs", mark: true },
      { text: ", Marcus. Teams at that stage usually hit a ramp gap first. Happy to share how two of them closed it?" },
    ],
  },
  {
    initials: "DC",
    name: "Daniel Cho",
    role: "Sales Director · Summit Ridge",
    tint: "#0f766e",
    fit: 87,
    signal: "Started a new role · 3w",
    opener: [
      { text: "Congrats on " },
      { text: "the new role", mark: true },
      { text: ", Daniel. The first 90 days usually means rebuilding pipeline from scratch. Want the playbook two directors used in theirs?" },
    ],
  },
  {
    initials: "AO",
    name: "Aisha Okafor",
    role: "Founder · Brightlane",
    tint: "#0f9d6e",
    fit: 89,
    signal: "Raised a seed round · 2w",
    opener: [
      { text: "Congrats on " },
      { text: "the seed round", mark: true },
      { text: ", Aisha. Outbound is usually the first thing that slips after a raise, and it's the part we take off founders' plates. Open to comparing notes?" },
    ],
  },
  {
    initials: "LR",
    name: "Luis Ramos",
    role: "Head of Sales · Meridian",
    tint: "#0c9fce",
    fit: 88,
    signal: "Hired a first AE · 9d",
    opener: [
      { text: "Saw you just " },
      { text: "hired your first AE", mark: true },
      { text: ", Luis. Most teams hit a hand-off gap right at that stage. Happy to share what worked for two teams like Meridian?" },
    ],
  },
  {
    initials: "PN",
    name: "Priya Nair",
    role: "COO · Fieldnote",
    tint: "#c2557d",
    fit: 90,
    signal: "Expanding to a second market · 1w",
    opener: [
      { text: "Big step taking Fieldnote into " },
      { text: "a second market", mark: true },
      { text: ", Priya. A new region usually starts with a cold pipeline, and that's the part we help warm up on LinkedIn. Worth a short call?" },
    ],
  },
  {
    initials: "EP",
    name: "Elena Petrova",
    role: "VP Revenue · Lattice Row",
    tint: "#5e6ad2",
    fit: 91,
    signal: "Posted about pipeline coverage · 2d",
    opener: [
      { text: "Your post on " },
      { text: "pipeline coverage", mark: true },
      { text: " hit home, Elena. Coverage is the one number we obsess over too. Worth swapping notes for 20 minutes?" },
    ],
  },
  {
    initials: "GK",
    name: "Grace Kim",
    role: "Growth Lead · Meridian",
    tint: "#7c3aed",
    fit: 88,
    signal: "Commented on outbound tooling · 1d",
    opener: [
      { text: "Your comment on " },
      { text: "outbound tooling", mark: true },
      { text: " was spot on, Grace. Most teams still prospect by hand. Open to seeing how a few automate the boring half?" },
    ],
  },
  {
    initials: "AK",
    name: "Arjun Kapoor",
    role: "Founder · Ledgerline",
    tint: "#0c9fce",
    fit: 93,
    signal: "Launched a new product · 1w",
    opener: [
      { text: "Saw " },
      { text: "the Ledgerline launch", mark: true },
      { text: ", Arjun. Founders usually park outbound right after one, and that's exactly the part we keep running. Open to a quick chat?" },
    ],
  },
  {
    initials: "AD",
    name: "Amara Diallo",
    role: "RevOps Lead · Copperleaf",
    tint: "#d97706",
    fit: 92,
    signal: "Posted about CRM hygiene · 3d",
    opener: [
      { text: "Loved your take on " },
      { text: "CRM hygiene", mark: true },
      { text: ", Amara. Messy handoffs are usually where pipeline leaks first. Happy to share how two RevOps teams plugged it?" },
    ],
  },
  {
    initials: "FR",
    name: "Fatima Rahman",
    role: "CEO · Harbor & Co",
    tint: "#0f766e",
    fit: 92,
    signal: "Opened a London office · 2w",
    opener: [
      { text: "A " },
      { text: "London office", mark: true },
      { text: " is a big step, Fatima. The first quarter there usually runs on referrals alone. Worth 20 minutes on how two firms built pipeline faster?" },
    ],
  },
  {
    initials: "SM",
    name: "Sofia Marchetti",
    role: "COO · Fernway",
    tint: "#7c3aed",
    fit: 90,
    signal: "Spoke at a RevOps summit · 4d",
    opener: [
      { text: "Saw you spoke at " },
      { text: "the RevOps summit", mark: true },
      { text: ", Sofia. Pipeline that doesn't lean on referrals is the thing we help ops teams build. Open to 20 minutes on how?" },
    ],
  },
  {
    initials: "ML",
    name: "Mei Lin",
    role: "Head of Sales · Ember Studio",
    tint: "#d97706",
    fit: 90,
    signal: "Promoted to Head of Sales · 1w",
    opener: [
      { text: "Well deserved on " },
      { text: "the promotion", mark: true },
      { text: ", Mei. New sales leads usually inherit a thin pipeline first. Open to a quick swap on how two studios rebuilt theirs?" },
    ],
  },
];

export function openerLength(p: Prospect): number {
  return p.opener.reduce((n, part) => n + part.text.length, 0);
}

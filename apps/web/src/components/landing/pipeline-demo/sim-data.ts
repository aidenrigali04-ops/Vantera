/**
 * The hybrid demo engine for the landing-page Pipeline Theater.
 *
 * Hand-curated ICP "flavors" (industry, role, signal, pain pools) are expanded
 * by a seeded generator into believable prospects shaped to Vantera's REAL
 * model: discovery fields, the enrichment waterfall (email/phone/firmographics/
 * technographics/signals), and the AI-rank insights (`score`, `rationale`,
 * `pain_points`, `triggers`, `aha_moment`). Preset chips run a flavor directly;
 * free text is keyword-matched to the nearest flavor and seeded by the query so
 * the same input always reproduces the same run (no SSR/CSR drift, no API cost).
 *
 * This is a marketing simulation on sample data — it never calls a real provider.
 */

export type Channel = "email" | "linkedin" | "call";

export type ProspectStatus =
  | "sourced"
  | "rejected"
  | "qualified"
  | "enriched"
  | "in_campaign"
  | "replied"
  | "converted";

export interface ProspectDraft {
  channel: Channel;
  subject?: string;
  body: string;
}

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  domain: string;
  industry: string;
  location: string;
  companySize: string;
  // Enrichment waterfall (spent on rules-gate survivors only)
  email: string;
  emailValid: boolean;
  phone: string;
  phoneValid: boolean;
  techStack: string[];
  signal: string;
  // AI rank (mirrors leads.ai_score + leads.ai_insights)
  score: number;
  rationale: string;
  painPoints: string[];
  triggers: string[];
  ahaMoment: string;
  // Pipeline outcome for the visible sample
  fit: boolean; // passed the deterministic rules gate
  channels: Channel[];
  draft: ProspectDraft;
  replied: boolean;
  booked: boolean;
}

export interface DemoStats {
  /** Total prospects pulled in the full run (we only render a sample). */
  sourced: number;
  /** Passed both gates — the "+N more ready" number behind the paywall. */
  qualified: number;
  meetings: number;
  pipelineValue: number;
  mrrGoal: number;
}

export interface DemoDataset {
  id: string;
  query: string;
  label: string;
  prospects: Prospect[];
  stats: DemoStats;
}

interface Flavor {
  id: string;
  label: string;
  query: string;
  keywords: string[];
  industry: string;
  companies: string[];
  titles: string[];
  locations: string[];
  tech: string[];
  signals: string[];
  pains: string[];
  triggers: string[];
  ahas: string[];
  /** Aggregate full-run numbers for the funnel + gated payoff. */
  stats: DemoStats;
}

const FIRST_NAMES = [
  "Maya", "Daniel", "Priya", "Marcus", "Elena", "Jordan", "Sofia", "Andre",
  "Hannah", "Leo", "Naomi", "Tomás", "Grace", "Wesley", "Aisha", "Caleb",
  "Renata", "Owen", "Yuki", "Diego", "Claire", "Idris", "Lena", "Mateo",
];
const LAST_NAMES = [
  "Rivera", "Okafor", "Castellanos", "Whitfield", "Nakamura", "Bauer",
  "Delgado", "Fitzgerald", "Almeida", "Kowalski", "Henderson", "Vasquez",
  "Larsen", "Adeyemi", "Sokolov", "Bianchi", "Park", "Mercer", "Nguyen", "Holt",
];

/** Strings → 32-bit seed (cyrb53-lite). Deterministic across renders. */
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — small, fast, seedable PRNG. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

function sampleUnique<T>(rng: () => number, arr: T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

function domainFor(company: string): string {
  const base = company
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return `${base}.com`;
}

function buildDraft(rng: () => number, p: {
  firstName: string;
  company: string;
  trigger: string;
  pain: string;
  channels: Channel[];
}): ProspectDraft {
  const channel = p.channels[0];
  const triggerShort = p.trigger.replace(/\s*\(.*\)$/, "");
  if (channel === "email") {
    return {
      channel,
      subject: pick(rng, ["quick one", "saw the news", `${p.company.split(" ")[0].toLowerCase()}`, "timing"]),
      body: `Hi ${p.firstName} — noticed ${triggerShort.toLowerCase()}. Teams hitting that usually start feeling ${p.pain.toLowerCase()}. Worth a 15-min look at how we'd handle it?`,
    };
  }
  if (channel === "linkedin") {
    return {
      channel,
      body: `Hi ${p.firstName}, congrats on ${triggerShort.toLowerCase()} — curious how you're handling ${p.pain.toLowerCase()} through it. Happy to share what's working for similar teams.`,
    };
  }
  return {
    channel,
    body: `Opener: reference ${triggerShort.toLowerCase()}. Goal: book 20 min on ${p.pain.toLowerCase()}. Objection path ready.`,
  };
}

const ALL_CHANNELS: Channel[] = ["email", "linkedin", "call"];

function generateProspect(rng: () => number, flavor: Flavor, index: number, fit: boolean): Prospect {
  const firstName = pick(rng, FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  const company = pick(rng, flavor.companies);
  const domain = domainFor(company);
  const title = pick(rng, flavor.titles);
  const pains = sampleUnique(rng, flavor.pains, 2 + Math.floor(rng() * 2));
  const triggers = sampleUnique(rng, flavor.triggers, 1 + Math.floor(rng() * 2));
  const tech = sampleUnique(rng, flavor.tech, 2 + Math.floor(rng() * 2));
  const aha = pick(rng, flavor.ahas);
  const signal = pick(rng, flavor.signals);

  // Qualified prospects score high (timing + fit); rejected ones miss the gate.
  const score = fit ? 72 + Math.floor(rng() * 23) : 28 + Math.floor(rng() * 34);
  const channels = fit
    ? sampleUnique(rng, ALL_CHANNELS, score > 88 ? 3 : 2).sort(
        (a, b) => ALL_CHANNELS.indexOf(a) - ALL_CHANNELS.indexOf(b),
      )
    : [];
  const size = 40 + Math.floor(rng() * 920);

  return {
    id: `${flavor.id}-${index}`,
    firstName,
    lastName,
    title,
    company,
    domain,
    industry: flavor.industry,
    location: pick(rng, flavor.locations),
    companySize: `${size} employees`,
    email: `${firstName[0].toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
    emailValid: true,
    phone: `+1 (${200 + Math.floor(rng() * 700)}) ${100 + Math.floor(rng() * 800)}-${1000 + Math.floor(rng() * 8999)}`,
    phoneValid: score > 80,
    techStack: tech,
    signal,
    score,
    rationale: `${title} at a ${size}-person ${flavor.industry.toLowerCase()} company — ${triggers[0].replace(/\s*\(.*\)$/, "").toLowerCase()}.`,
    painPoints: pains,
    triggers,
    ahaMoment: aha,
    fit,
    channels,
    draft: buildDraft(rng, { firstName, company, trigger: triggers[0], pain: pains[0], channels: channels.length ? channels : ["email"] }),
    replied: false,
    booked: false,
  };
}

function generateDataset(flavor: Flavor, query: string): DemoDataset {
  const rng = makeRng(hashSeed(`${flavor.id}::${query.toLowerCase().trim()}`));
  const TOTAL = 11;
  const FIT_COUNT = 8;
  const prospects: Prospect[] = [];
  for (let i = 0; i < TOTAL; i++) {
    prospects.push(generateProspect(rng, flavor, i, i < FIT_COUNT));
  }
  // Sort qualified-first, then by score desc, so the gate visibly culls the tail.
  prospects.sort((a, b) => Number(b.fit) - Number(a.fit) || b.score - a.score);

  // Mark replies + one booked among the strongest qualified prospects.
  const qualified = prospects.filter((p) => p.fit);
  qualified.slice(0, 3).forEach((p) => (p.replied = true));
  if (qualified[0]) qualified[0].booked = true;

  return {
    id: flavor.id,
    query,
    label: flavor.label,
    prospects,
    stats: flavor.stats,
  };
}

// ── Curated ICP flavors (the chips). Each expands into a full, tailored run. ──

const FLAVORS: Flavor[] = [
  {
    id: "fintech-cfo",
    label: "Series B fintech CFOs",
    query: "CFOs at Series B fintech companies in North America",
    keywords: ["fintech", "cfo", "finance", "payments", "banking", "series b"],
    industry: "Fintech",
    companies: ["Northwind Pay", "Ledgerly", "Cadence Capital", "Plaidstone", "Remit OS", "Vaultline", "Aperture Bank", "Stride Finance"],
    titles: ["Chief Financial Officer", "VP of Finance", "Head of Finance", "VP Finance & Ops"],
    locations: ["New York, NY", "Austin, TX", "Toronto, ON", "San Francisco, CA"],
    tech: ["NetSuite", "Stripe", "Salesforce", "Looker", "Snowflake"],
    signals: ["Series B · $42M (3 weeks ago)", "Hired 6 finance roles last quarter", "Expanded into 2 new markets", "New revenue-ops lead onboarded"],
    pains: ["manual board reporting", "slow runway forecasting", "no real-time burn visibility", "spreadsheet-bound close cycles"],
    triggers: ["closed a Series B ($42M)", "doubled headcount in 6 months", "launched a new product line", "switched billing systems"],
    ahas: ["Cut the monthly close from 9 days to 2", "See live runway without a single spreadsheet", "Forecast burn in minutes, not weeks"],
    stats: { sourced: 214, qualified: 150, meetings: 12, pipelineValue: 48000, mrrGoal: 50000 },
  },
  {
    id: "saas-sales",
    label: "B2B SaaS VPs of Sales",
    query: "VPs of Sales at mid-market B2B SaaS companies",
    keywords: ["saas", "sales", "vp sales", "b2b", "revenue", "go to market"],
    industry: "B2B SaaS",
    companies: ["Loopwork", "Tunnel", "Brightfold", "Cadenza", "Outpace", "Helm", "Quanta Labs", "Northstar OS"],
    titles: ["VP of Sales", "Head of Revenue", "VP Revenue", "Director of Sales"],
    locations: ["Denver, CO", "Boston, MA", "Chicago, IL", "Remote (US)"],
    tech: ["Salesforce", "Outreach", "Gong", "HubSpot", "Segment"],
    signals: ["Posted 4 AE roles this month", "Series A · $18M (last month)", "New VP Marketing joined", "Launched outbound motion"],
    pains: ["reps spend 40% of the week prospecting", "pipeline coverage below 3x", "ramp time too long for new AEs", "inconsistent lead quality"],
    triggers: ["opened 4 new AE seats", "raised a Series A", "missed last quarter's number", "stood up an outbound team"],
    ahas: ["Give every rep a full pipeline before Monday", "3x meetings booked without new headcount", "Stop paying AEs to copy-paste prospecting"],
    stats: { sourced: 268, qualified: 176, meetings: 19, pipelineValue: 71000, mrrGoal: 75000 },
  },
  {
    id: "ecommerce-growth",
    label: "DTC ecommerce founders",
    query: "Founders and Heads of Growth at DTC ecommerce brands",
    keywords: ["ecommerce", "dtc", "founder", "retail", "shopify", "growth", "brand"],
    industry: "DTC Ecommerce",
    companies: ["Maker & Field", "Tidewell", "Cobalt Goods", "Everpeak", "Brava", "Hearthline", "Lumen & Co", "Driftwear"],
    titles: ["Founder & CEO", "Head of Growth", "VP Ecommerce", "Director of Growth"],
    locations: ["Los Angeles, CA", "Miami, FL", "Brooklyn, NY", "Portland, OR"],
    tech: ["Shopify Plus", "Klaviyo", "Meta Ads", "Recharge", "Triple Whale"],
    signals: ["Crossed $5M ARR (this quarter)", "Launched wholesale channel", "Hired first retention lead", "Rising paid CAC flagged"],
    pains: ["rising customer acquisition cost", "no outbound wholesale motion", "thin first-party data", "over-reliance on paid ads"],
    triggers: ["crossed $5M in revenue", "opened a wholesale line", "saw CAC climb 30%", "expanded to a new category"],
    ahas: ["Open a wholesale pipeline without hiring a sales team", "Land 10 retail buyers this month", "Diversify off paid ads in weeks"],
    stats: { sourced: 192, qualified: 128, meetings: 9, pipelineValue: 33000, mrrGoal: 40000 },
  },
  {
    id: "healthtech-ops",
    label: "Healthtech ops leaders",
    query: "Heads of Operations at healthtech and digital health companies",
    keywords: ["health", "healthtech", "medical", "clinical", "ops", "operations", "digital health"],
    industry: "Healthtech",
    companies: ["Caretrace", "Vitalink", "Meridian Health", "Pulsewell", "Northcare", "Clarity Health", "Evoke Medical", "Tendwell"],
    titles: ["Head of Operations", "VP Operations", "COO", "Director of Clinical Ops"],
    locations: ["Nashville, TN", "Minneapolis, MN", "San Diego, CA", "Raleigh, NC"],
    tech: ["Epic", "Salesforce Health Cloud", "Twilio", "Snowflake", "Tableau"],
    signals: ["FDA clearance announced", "Series B · $35M (2 months ago)", "Opened 3 new clinic sites", "New VP of Growth hired"],
    pains: ["fragmented patient intake", "manual provider outreach", "long sales cycles to clinics", "compliance-heavy workflows"],
    triggers: ["received FDA clearance", "raised a Series B", "expanded clinic network", "launched a payer partnership"],
    ahas: ["Reach 50 clinic decision-makers — compliantly", "Shorten the clinic sales cycle by half", "Outreach that respects every compliance rule"],
    stats: { sourced: 156, qualified: 102, meetings: 8, pipelineValue: 61000, mrrGoal: 60000 },
  },
  {
    id: "agency-owner",
    label: "Marketing agency owners",
    query: "Founders and owners of marketing and creative agencies",
    keywords: ["agency", "marketing", "creative", "owner", "consultant", "services"],
    industry: "Marketing Agency",
    companies: ["Halo Studio", "Bright Lane", "Kindling", "Northbound", "Mavenhouse", "Studio Ardent", "Foreword", "Tilt Collective"],
    titles: ["Founder", "Managing Partner", "Agency Owner", "Head of New Business"],
    locations: ["Austin, TX", "Atlanta, GA", "Remote (US)", "Seattle, WA"],
    tech: ["HubSpot", "Asana", "Webflow", "Notion", "Figma"],
    signals: ["Hiring 3 account roles", "Won a national retainer", "Spun up a new service line", "Founder posting about pipeline"],
    pains: ["feast-or-famine new business", "owner is the only rainmaker", "no consistent outbound", "referral-dependent pipeline"],
    triggers: ["launched a new service line", "lost a major retainer", "hired senior account staff", "hit a hiring wall"],
    ahas: ["A new-business pipeline that runs without the founder", "Book discovery calls while you do the work", "Stop riding the referral rollercoaster"],
    stats: { sourced: 178, qualified: 119, meetings: 11, pipelineValue: 27000, mrrGoal: 30000 },
  },
  {
    id: "manufacturing",
    label: "Industrial / manufacturing VPs",
    query: "VPs of Sales and Operations at industrial manufacturing firms",
    keywords: ["manufacturing", "industrial", "supply", "logistics", "operations", "plant", "hardware"],
    industry: "Manufacturing",
    companies: ["Forgewright", "Apex Industrial", "Cole & Vance", "Ironside", "Meridian Mfg", "Steelhaus", "Pacific Components", "Granite Works"],
    titles: ["VP of Sales", "VP Operations", "Plant Director", "Head of Business Development"],
    locations: ["Cleveland, OH", "Detroit, MI", "Houston, TX", "Charlotte, NC"],
    tech: ["SAP", "Salesforce", "NetSuite", "Microsoft Dynamics", "Tableau"],
    signals: ["Opened a new facility", "Reshoring initiative announced", "Hired a digital-sales lead", "New ERP rollout underway"],
    pains: ["relationship sales doesn't scale", "long, manual quoting cycles", "thin new-logo pipeline", "aging customer base"],
    triggers: ["opened a new plant", "announced reshoring", "added a product line", "modernized their ERP"],
    ahas: ["Modern outbound for a relationship-sales world", "Fill the pipeline beyond the trade show", "Reach new buyers your reps never had time for"],
    stats: { sourced: 203, qualified: 141, meetings: 10, pipelineValue: 88000, mrrGoal: 90000 },
  },
];

const DEFAULT_FLAVOR = FLAVORS[0];

/** The chips shown under the search bar (label + the query they fill in). */
export const ICP_PRESETS = FLAVORS.map((f) => ({ id: f.id, label: f.label, query: f.query }));

/** Best-effort flavor match for free-text input; falls back to SaaS sales. */
function matchFlavor(query: string): Flavor {
  const q = query.toLowerCase();
  let best: Flavor | null = null;
  let bestScore = 0;
  for (const f of FLAVORS) {
    let s = 0;
    for (const kw of f.keywords) if (q.includes(kw)) s += kw.length;
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }
  return best ?? FLAVORS[1];
}

/** Run a preset chip by id (handcrafted flavor, its canonical query). */
export function datasetForPreset(id: string): DemoDataset {
  const flavor = FLAVORS.find((f) => f.id === id) ?? DEFAULT_FLAVOR;
  return generateDataset(flavor, flavor.query);
}

/** Run arbitrary free text: keyword-match a flavor, seed by the query. */
export function datasetForQuery(query: string): DemoDataset {
  const trimmed = query.trim();
  if (!trimmed) return datasetForPreset(DEFAULT_FLAVOR.id);
  const flavor = matchFlavor(trimmed);
  // Re-label to echo the user's words back (endowed ownership of the result).
  return { ...generateDataset(flavor, trimmed), label: trimmed };
}

/** The auto-running demo shown on first load. */
export const DEFAULT_DATASET_ID = DEFAULT_FLAVOR.id;

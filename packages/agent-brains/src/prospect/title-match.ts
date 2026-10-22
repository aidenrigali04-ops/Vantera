/**
 * Title matching for the rules gate. A wanted ICP title matches a candidate's headline when every
 * function word of the wanted title starts a word in the headline (any order), and — if the wanted
 * title names a leadership level — the headline names ANY leadership level. So "Sales Director"
 * matches "Director of Sales & BD" and "VP Sales", "CEO" matches "Chief Executive Officer", and
 * "Head of Business Development" matches "Vice President, Business Development". A wanted title
 * that is ONLY a level ("VP", "Director") is a seniority filter and requires that level. Pure.
 */

/** Spelled-out titles → the abbreviation an ICP usually lists. Applied before tokenizing. */
const PHRASES: [RegExp, string][] = [
  [/\bchief executive officer\b/g, "ceo"],
  [/\bchief technology officer\b/g, "cto"],
  [/\bchief financial officer\b/g, "cfo"],
  [/\bchief operating officer\b/g, "coo"],
  [/\bchief marketing officer\b/g, "cmo"],
  [/\bchief revenue officer\b/g, "cro"],
  [/\bchief commercial officer\b/g, "cco"],
  [/\bchief product officer\b/g, "cpo"],
  [/\bsenior vice president\b/g, "svp"],
  [/\bexecutive vice president\b/g, "evp"],
  [/\bvice[\s-]+president\b/g, "vp"],
  [/\bv\.\s?p\.?(?=\s|$)/g, "vp"],
  [/\bco[\s-]?founder/g, "co founder"],
  // the top-executive title outside the US, and at owner-run companies — CEO-level
  [/\bmanaging (?:director|partner)\b/g, "$& ceo"],
  [/\bowner\b/g, "owner ceo"],
  [/(?<!\bvice[\s-]?)\bpresident\b/g, "president ceo"],
];

/** Token aliases: an abbreviation expands to the words a headline might spell out. */
const ALIASES: Record<string, string[]> = {
  bd: ["business", "development"],
  biz: ["business"],
  dir: ["director"],
  sr: ["senior"],
  mgr: ["manager"],
  svp: ["svp", "vp"],
  evp: ["evp", "vp"],
  avp: ["avp", "vp"],
};

/** Leadership levels — interchangeable when the wanted title names one. */
const LEADERSHIP = new Set(["head", "vp", "svp", "evp", "avp", "director", "chief", "president"]);

const STOPWORDS = new Set(["of", "and", "the", "for", "in", "at", "to", "a", "an"]);

function tokens(value: string): string[] {
  let v = value.toLowerCase();
  for (const [re, to] of PHRASES) v = v.replace(re, to);
  return v
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .flatMap((t) => ALIASES[t] ?? [t]);
}

/** True when the candidate headline satisfies one wanted title (see the module comment). */
export function titleMatches(headline: string, wanted: string): boolean {
  const want = tokens(wanted);
  if (want.length === 0) return false;
  const have = tokens(headline);
  // word-start match: "engineer" covers "engineering"; "cto" never matches inside "director"
  const has = (t: string) => have.some((h) => h.startsWith(t));
  const functionWords = want.filter((t) => !LEADERSHIP.has(t));
  const needsLeader = want.some((t) => LEADERSHIP.has(t));
  if (functionWords.length === 0) return want.some((t) => have.includes(t));
  if (!functionWords.every(has)) return false;
  return !needsLeader || have.some((h) => LEADERSHIP.has(h));
}

export function titleMatchesAny(headline: string, wanted: string[]): boolean {
  return wanted.some((w) => titleMatches(headline, w));
}

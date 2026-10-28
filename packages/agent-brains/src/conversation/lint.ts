import { BUMP_PHRASES, type Violation } from "../copy/humanizer";
import { openerSkeleton, openerSkeletons } from "../copy/opener";
import { LENGTH_BAND_CHARS, type LinkKind, type Move, type Style } from "./moves";
import { pitchPattern } from "./rules";
import { deriveStage, phaseOf, type ConversationState } from "./state";

export type LintContext = {
  move: Move;
  style: Style;
  state: ConversationState;
  sellerName: string | null;
  /** the prospect's name/company words, stripped before opener skeletons are compared */
  identity: string;
  avoidSkeletons: string[];
  /** ordered [booking, website, ...content] (empties dropped) */
  allowedLinks: string[];
  /** parallel to `allowedLinks`; when absent the [booking, website, ...content] order is assumed */
  linkKinds?: LinkKind[];
};

const HOOK_MIN_WORDS = 4;
const URL_RE = /https?:\/\/[^\s)>\]]+/gi;
const LABEL_RE = /\b(?:sounds like|seems like|it sounds as if)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9'\s]/g, " ").replace(/\s+/g, " ").trim();
const trimUrl = (u: string) => u.replace(/[.,;:!?]+$/, "").replace(/\/+$/, "").toLowerCase();
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

function kindOfUrl(url: string, ctx: LintContext): LinkKind | null {
  const u = trimUrl(url);
  const idx = ctx.allowedLinks.findIndex((a) => trimUrl(a) === u);
  if (idx < 0) return null;
  if (ctx.linkKinds?.[idx]) return ctx.linkKinds[idx]!;
  return idx === 0 ? "booking" : idx === 1 ? "website" : "content";
}

/** Thread-aware lints for a message written for a specific move (spec §7.1). Pure, deterministic. */
export function lintForMove(message: string, ctx: LintContext): Violation[] {
  const out: Violation[] = [];
  const { state, style } = ctx;

  const skeleton = openerSkeleton(message, ctx.identity);
  const seen = new Set([...ctx.avoidSkeletons, ...openerSkeletons(state.memory.hooksUsed.map((h) => h.text), ctx.identity)]);
  if (skeleton && seen.has(skeleton)) {
    out.push({ rule: "second-opener", detail: `the message opens like an earlier one ("${skeleton}…"); this is not a first touch, so do not open again` });
  }

  const nm = norm(message);
  for (const hook of state.memory.hooksUsed) {
    const h = norm(hook.text);
    if (h.split(" ").filter(Boolean).length >= HOOK_MIN_WORDS && nm.includes(h)) {
      out.push({ rule: "hook-reuse", detail: `repeats a hook already used in this thread ("${h}")` });
      break;
    }
  }

  const phase = phaseOf(deriveStage(state));
  if ((phase === "pre_reply" || phase === "engaged") && pitchPattern(ctx.sellerName).test(message)) {
    out.push({ rule: "pitch-before-exploring", detail: "pitch language (seller name, platform, AI, all-in-one, ROI or a percentage) before they have described a problem" });
  }

  const lower = message.toLowerCase();
  for (const phrase of BUMP_PHRASES) {
    if (lower.includes(phrase)) {
      out.push({ rule: "bump-phrase", detail: `bump phrase "${phrase}"; say something new instead of nudging` });
      break;
    }
  }

  const questions = count(message, /\?/g);
  if (questions > 1) out.push({ rule: "too-many-questions", detail: `${questions} questions; ask at most one` });
  if (questions > 0 && style.question === false) out.push({ rule: "question-not-allowed", detail: "this message must not ask a question" });

  const we = count(message, /\bwe\b/gi);
  const i = count(message, /\bI\b/g);
  const you = count(message, /\byou\b|\byour\b/gi);
  if (we > 1 || i > 2 || you === 0) {
    out.push({ rule: "pronoun-balance", detail: `keep the focus on them: "we" x${we} (max 1), "I" x${i} (max 2), and use "you/your"` });
  }

  const max = LENGTH_BAND_CHARS[style.lengthBand];
  if (message.length > max) out.push({ rule: "length-band", detail: `${message.length} chars; the ${style.lengthBand} band allows ${max}` });

  for (const url of message.match(URL_RE) ?? []) {
    const kind = kindOfUrl(url, ctx);
    if (kind !== style.link) {
      out.push({ rule: "link-not-allowed", detail: `link ${url} is not the ${style.link === "none" ? "allowed (no link this turn)" : style.link} link` });
      break;
    }
  }

  if (LABEL_RE.test(message) && state.counters.labelsUsed >= 1) {
    out.push({ rule: "label-overuse", detail: "a tentative label (\"sounds like…\") was already used in this thread" });
  }

  return out;
}

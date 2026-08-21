import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ConversationDraft,
  ConversationMessageInput,
  DraftInput,
  LinkedInDraft,
} from "@vantera/agent-brains";

/**
 * The golden-set fixture format for the two copy brains (Phase 2B, Task 3). Each case pairs a
 * VALID brain input (the exact shape `draftLinkedIn`/`draftConversationMessage` accept) with the
 * citable-facts `grounding` string the humanizer's ungrounded-claim lint checks against, and an
 * optional hand-written `frozenDraft` — a lint-clean accepted baseline used as the frozen-lint /
 * pairwise-comparison reference by later eval suites (Task 4+). Fixtures are anonymized JSON files
 * under `fixtures/copy-linkedin/` and `fixtures/copy-respond/`, loaded at test/eval time via
 * `fs.readdirSync` + `JSON.parse` (not static `import` — this runs under vitest's node
 * environment, so a directory-read loader keeps adding a fixture a one-file change).
 */
export type CopyLinkedinCase = {
  /** kebab-case, unique across the corpus */
  id: string;
  /** the real brain input type: { lead, insights, context } */
  input: DraftInput;
  /** the citable-facts string the humanizer lints (e.g. findUngroundedClaims) check against */
  grounding: string;
  /** an accepted baseline draft — hand-written, lint-clean (frozen-lint + pairwise reference) */
  frozenDraft?: LinkedInDraft;
  notes?: string;
};

export type CopyRespondCase = {
  id: string;
  /** the real brain input type: { lead, insights, context, thread, incoming?, classification? } */
  input: ConversationMessageInput;
  grounding: string;
  frozenDraft?: ConversationDraft;
  notes?: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, "..", "fixtures");

/** Reads every `*.json` file in `fixtures/<subdir>`, parsed in filename order (deterministic). */
function readJsonCases<T>(subdir: string): T[] {
  const dir = join(FIXTURES_ROOT, subdir);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T);
}

export function loadCopyLinkedinCorpus(): CopyLinkedinCase[] {
  return readJsonCases<CopyLinkedinCase>("copy-linkedin");
}

export function loadCopyRespondCorpus(): CopyRespondCase[] {
  return readJsonCases<CopyRespondCase>("copy-respond");
}

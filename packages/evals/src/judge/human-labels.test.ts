import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { HumanLabel } from "./kappa";

/**
 * Fixture-integrity guardrail for `fixtures/judge-calibration/human-labels.json` (Phase 2B —
 * pre-merge cleanup). The file's own README instructs the owner to paste ~100 REAL hand-rated
 * drafts into this JSON during judge calibration; unlike the golden-set corpora
 * (`corpus.test.ts`), nothing previously scanned this file before it lands in git. This test
 * closes that gap: it tolerates the shipped empty `[]`, but the moment real entries are appended
 * it fails the build on a leaked vendor name or a non-`.example` URL — the same white-label rule
 * (`.claude/rules/03-05`) the corpora already enforce.
 *
 * The denylist/URL-allowlist here are intentionally a minimal, LOCAL copy (not imported from
 * `corpus.test.ts`, which doesn't export its constants) — see this task's brief for the exact
 * vendor list to cover.
 */

const VENDOR_DENYLIST = /\b(unipile|explorium|smartlead|clay|hubspot|waalaxy|goji\s?berry)\b/i;

// Same reserved-for-documentation convention as corpus.test.ts: only `.example` domains (RFC
// 2606) or the explicit fake booking/test domains are allowed in a committed fixture.
const ALLOWED_URL = /\.example\b|\b(?:book|meet|schedule)\.(?:test|invalid)\b/i;

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUMAN_LABELS_PATH = join(__dirname, "..", "..", "fixtures", "judge-calibration", "human-labels.json");

function loadHumanLabels(): HumanLabel[] {
  const raw = JSON.parse(readFileSync(HUMAN_LABELS_PATH, "utf8"));
  expect(Array.isArray(raw), "human-labels.json must be a JSON array").toBe(true);
  return raw as HumanLabel[];
}

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s"\\]+/g) ?? [];
}

describe("human-labels.json fixture integrity", () => {
  const labels = loadHumanLabels();

  // The file ships as `[]` until the owner runs a calibration labeling session — that empty state
  // must always pass. Every assertion below is a no-op over an empty array (vacuously true), so
  // this test protects the FUTURE filled file without ever failing on the current shipped state.
  it("ships as an array (empty is valid — no calibration session has run yet)", () => {
    expect(labels.length).toBeGreaterThanOrEqual(0);
  });

  it("every entry is shape-valid (draftId, draftText, grounding, humanOverall 1-5)", () => {
    for (const label of labels) {
      expect(typeof label.draftId, "draftId").toBe("string");
      expect(label.draftId.length, "draftId non-empty").toBeGreaterThan(0);
      expect(typeof label.draftText, "draftText").toBe("string");
      expect(label.draftText.length, "draftText non-empty").toBeGreaterThan(0);
      expect(typeof label.grounding, "grounding").toBe("string");
      expect(typeof label.humanOverall, "humanOverall").toBe("number");
      expect(label.humanOverall, `${label.draftId}.humanOverall in [1,5]`).toBeGreaterThanOrEqual(1);
      expect(label.humanOverall, `${label.draftId}.humanOverall in [1,5]`).toBeLessThanOrEqual(5);
    }
  });

  it("never leaks a real vendor name (white-label rule)", () => {
    for (const label of labels) {
      expect(label.draftText, `${label.draftId}.draftText`).not.toMatch(VENDOR_DENYLIST);
      expect(label.grounding, `${label.draftId}.grounding`).not.toMatch(VENDOR_DENYLIST);
    }
  });

  it("every URL is an obviously-fake domain (no real prospect/company URLs)", () => {
    for (const label of labels) {
      for (const url of [...extractUrls(label.draftText), ...extractUrls(label.grounding)]) {
        expect(ALLOWED_URL.test(url), `${label.draftId}: "${url}" is not an allowed fake domain`).toBe(true);
      }
    }
  });
});

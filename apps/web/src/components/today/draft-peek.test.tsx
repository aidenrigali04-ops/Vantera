import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { QueueRow } from "@/lib/today/rows";

// server actions + analytics never load in the test — the peek only references them
vi.mock("@/app/(app)/approvals/actions", () => ({ fixDraft: vi.fn(), regenerateDraft: vi.fn(), saveDraftEdit: vi.fn() }));
vi.mock("@/app/(app)/today/actions", () => ({ approveFromToday: vi.fn(), rejectDraftWithReason: vi.fn(), undoApproveDraft: vi.fn(), undoRejectDraft: vi.fn() }));
vi.mock("@/lib/analytics/activation", () => ({ trackFirstDraftApproved: vi.fn() }));

import { DraftPeek } from "./draft-peek";
import { STEER_MAX, steerNote } from "./draft-peek/steer-box";

function row(over: Partial<QueueRow> = {}): QueueRow {
  return {
    id: "d1",
    leadId: "l1",
    name: "Ada Park",
    context: "Founder · Northwind",
    initials: "AP",
    signal: null,
    signalFallback: null,
    score: 91,
    step: "Invite",
    sends: { label: "2:10–4:30pm", sender: "Anna K.", held: false },
    body: "Hi Ada — saw the hiring push.",
    styleFlags: null,
    channel: "linkedin",
    origin: "sequence",
    regenerable: true,
    evidence: [{ text: "Hiring 3 SDRs" }],
    rationale: "Strong fit",
    charLimit: 300,
    linkedinUrl: null,
    drafted: "now",
    ...over,
  };
}

function render(rows: QueueRow[], props: Partial<Parameters<typeof DraftPeek>[0]> = {}) {
  return renderToStaticMarkup(
    <DraftPeek rows={rows} openId={rows[0]?.id ?? null} onClose={() => {}} onNavigate={() => {}} onRemoved={() => {}} {...props} />
  );
}

/** the regenerate button's opening tag */
const regenButton = (html: string) => html.match(/<button[^>]*>(?:(?!<button)[\s\S])*?Regenerate/)?.[0] ?? "";

describe("DraftPeek", () => {
  it("renders the sheet variant as a modal dialog over an overlay", () => {
    const html = render([row()]);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Draft for Ada Park"');
    expect(html).toContain("fixed inset-0");
    expect(html).toContain("Hiring 3 SDRs");
    expect(html).toContain("Will send 2:10–4:30pm (pacing) via Anna K.");
  });

  it("renders the pane variant inline — no dialog, no overlay", () => {
    const html = render([row()], { variant: "pane" });
    expect(html).toMatch(/^<section aria-label="Draft for Ada Park"/);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("fixed inset-0");
  });

  it("renders nothing when no draft is open", () => {
    expect(render([row()], { openId: null })).toBe("");
  });

  it("shows Fix only when the draft carries style flags", () => {
    expect(render([row()])).not.toContain('data-copilot="fix-draft"');
    const flags = JSON.stringify([{ code: "em_dash", label: "Em dash" }]);
    expect(render([row({ styleFlags: flags })])).toContain('data-copilot="fix-draft"');
  });

  it("disables Regenerate with the reason when the draft isn't regenerable", () => {
    const off = render([row({ regenerable: false, origin: "reply_response" })]);
    const btn = regenButton(off);
    expect(btn).toContain('disabled=""');
    expect(btn).toContain('title="Replies are written from the conversation — edit this one instead."');

    expect(regenButton(render([row()]))).not.toContain('disabled=""');
  });

  it("shows the decline overflow only in the pane when onSuppress is given", () => {
    expect(render([row()], { variant: "pane" })).not.toContain("More actions");
    expect(render([row()], { variant: "pane", onSuppress: async () => ({}) })).toContain("More actions");
  });

  it("disables ← on the first draft and → on the last", () => {
    const html = render([row(), row({ id: "d2", name: "Bo" })]);
    expect(html).toMatch(/<button type="button" disabled=""[^>]*aria-label="Previous draft"/);
    expect(html).not.toMatch(/<button type="button" disabled=""[^>]*aria-label="Next draft"/);
  });
});

describe("steerNote (what G sends with a regenerate)", () => {
  it("trims and caps the steer text", () => {
    expect(steerNote("  shorter please  ")).toBe("shorter please");
    expect(steerNote("x".repeat(STEER_MAX + 20))).toHaveLength(STEER_MAX);
    expect(STEER_MAX).toBe(280);
  });
});

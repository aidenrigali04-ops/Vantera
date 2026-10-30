import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/app/(app)/approvals/actions", () => ({ saveDraftEdit: async () => ({}) }));
vi.mock("@/app/(app)/prospects/fit-actions", () => ({ setLeadFit: async () => ({}) }));
vi.mock("@/components/lead-crm-controls", () => ({ LeadCrmControls: () => null }));

import { LeadProfileSheet, type LeadProfile } from "./lead-profile";
import { handleProfileKey, isEditable } from "./lead-profile/profile-keys";
import { MessageSection } from "./lead-profile/sections";

const lead: LeadProfile = {
  id: "l1",
  first_name: "Sam",
  last_name: "Lee",
  title: "Founder",
  company_name: "Northwind",
  company_size: "11-50",
  industry: "Software",
  location: "Berlin",
  tech_stack: null,
  status: "qualified",
  ai_score: 88,
  ai_rationale: "Hiring SDRs",
  ai_insights: null,
  email: null,
  email_status: null,
  phone: null,
  phone_status: null,
  linkedin_url: null,
};

function nav(index: number, total = 3) {
  return { index, total, onPrev: vi.fn(), onNext: vi.fn() };
}
function key(k: string, target: EventTarget | null = null) {
  return { key: k, target, preventDefault: vi.fn() };
}
const field = (tagName: string) => ({ tagName, isContentEditable: false }) as unknown as EventTarget;

describe("lead profiler keyboard", () => {
  it("← calls nav.onPrev and → calls nav.onNext", () => {
    const n = nav(1);
    const left = key("ArrowLeft");
    handleProfileKey(left, () => {}, n);
    expect(n.onPrev).toHaveBeenCalledOnce();
    expect(left.preventDefault).toHaveBeenCalled();
    handleProfileKey(key("ArrowRight"), () => {}, n);
    expect(n.onNext).toHaveBeenCalledOnce();
  });

  it("stays in bounds at either end of the list", () => {
    const first = nav(0);
    handleProfileKey(key("ArrowLeft"), () => {}, first);
    expect(first.onPrev).not.toHaveBeenCalled();
    const last = nav(2);
    handleProfileKey(key("ArrowRight"), () => {}, last);
    expect(last.onNext).not.toHaveBeenCalled();
  });

  it("never navigates while typing in a field", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      const n = nav(1);
      handleProfileKey(key("ArrowRight", field(tag)), () => {}, n);
      expect(n.onNext).not.toHaveBeenCalled();
    }
    expect(isEditable({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isEditable(field("BUTTON"))).toBe(false);
    expect(isEditable(null)).toBe(false);
  });

  it("Escape closes, with or without nav", () => {
    const close = vi.fn();
    handleProfileKey(key("Escape"), close, undefined);
    handleProfileKey(key("Escape", field("TEXTAREA")), close, nav(1));
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe("LeadProfileSheet", () => {
  const render = (l: LeadProfile, extra: Partial<Parameters<typeof LeadProfileSheet>[0]> = {}) =>
    renderToStaticMarkup(<LeadProfileSheet lead={l} onClose={() => {}} {...extra} />);

  it("shows Not a fit in the footer until a fit verdict is set", () => {
    // the pinned footer's button (the Fit section's own controls render separately)
    const footerNotAFit = /hover:bg-\[var\(--surface-2\)\]">Not a fit<\/button><a /;
    expect(render(lead, { fullProfileHref: "/prospects/l1" })).toMatch(footerNotAFit);
    const judged = render({ ...lead, fit_verdict: "not_fit" }, { fullProfileHref: "/prospects/l1" });
    expect(judged).not.toMatch(footerNotAFit);
    expect(judged).toContain("Open full brief");
  });

  it("renders the nav position and disables ← on the first prospect", () => {
    const html = render(lead, { nav: nav(0) });
    expect(html).toContain("1 of 3");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Previous prospect"/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Next prospect"/);
  });

  it("renders every section the lead has data for", () => {
    const html = render(
      { ...lead, ai_insights: { summary: "Scaling outbound" }, queued_draft: { id: "s1", body: "Hi Sam", status: "pending_review", linkedin_stage: "invite", origin: null, style_flags: null } },
      { fullProfileHref: "/prospects/l1" }
    );
    for (const title of ["Signals", "Why this rank", "Why this prospect", "Company", "Message", "Fit", "CRM", "Notes"]) {
      expect(html, title).toContain(`</svg>${title}</button>`);
    }
    expect(html).toContain("Open full brief");
  });
});

describe("MessageSection", () => {
  const draft = { id: "s1", body: "Hi Sam", status: "pending_review", linkedin_stage: "invite", origin: null, style_flags: null };

  it("offers Edit only while the draft is pending review", () => {
    expect(renderToStaticMarkup(<MessageSection draft={draft} />)).toContain(">Edit</button>");
    for (const status of ["approved", "scheduled"]) {
      const html = renderToStaticMarkup(<MessageSection draft={{ ...draft, status }} />);
      expect(html, status).not.toContain(">Edit</button>");
      expect(html, status).toContain("Hi Sam");
    }
  });
});

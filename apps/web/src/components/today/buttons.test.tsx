import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GhostButton, InkButton, TextLink } from "./buttons";

describe("InkButton", () => {
  it("renders a Link when href is given", () => {
    const html = renderToStaticMarkup(<InkButton href="/approvals">Open queue</InkButton>);
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/approvals"');
    expect(html).toContain("Open queue");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
  });

  it("renders a type=button with onClick", () => {
    const html = renderToStaticMarkup(<InkButton onClick={() => {}}>Resume engine</InkButton>);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).not.toContain("<form");
  });

  it("renders a form submit when a server action is given", () => {
    const html = renderToStaticMarkup(<InkButton action={async () => {}}>Resume engine</InkButton>);
    expect(html).toMatch(/^<form /);
    expect(html).toContain('<button type="submit"');
  });

  it("is the ink fill: --ink background, --ink-fg text, 40px tall, --r-btn radius, focus ring", () => {
    const html = renderToStaticMarkup(<InkButton href="/inbox">Open inbox</InkButton>);
    for (const cls of [
      "h-10",
      "px-4",
      "rounded-[var(--r-btn)]",
      "bg-[var(--ink)]",
      "text-[var(--ink-fg)]",
      "text-sm",
      "font-medium",
      "hover:bg-[#1f1f23]",
      "active:translate-y-[0.5px]",
      "focus-visible:shadow-[var(--focus-ring)]",
      "duration-120",
      "ease-out",
    ]) {
      expect(html, cls).toContain(cls);
    }
  });

  it("renders the mono count pill only when a count is given", () => {
    const withCount = renderToStaticMarkup(
      <InkButton href="/approvals" count={12}>
        Open queue
      </InkButton>
    );
    expect(withCount).toContain(">12</span>");
    expect(withCount).toContain("font-mono");
    expect(withCount).toContain("h-[18px]");
    expect(withCount).toContain("bg-[rgb(255_255_255_/_0.16)]");

    const without = renderToStaticMarkup(
      <InkButton href="/approvals" count={null}>
        Open queue
      </InkButton>
    );
    expect(without).not.toContain("font-mono");
  });

  it("renders a 16px glyph with the 1.75 stroke when asked", () => {
    const html = renderToStaticMarkup(
      <InkButton href="/approvals" glyph="check-square">
        Open queue
      </InkButton>
    );
    expect(html).toContain("<svg");
    expect(html).toContain('width="16"');
    expect(html).toContain('height="16"');
    expect(html).toContain('stroke-width="1.75"');
    expect(html).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<InkButton href="/approvals">Open queue</InkButton>)).not.toContain("<svg");
  });
});

describe("GhostButton", () => {
  it("renders a hairline 36px button as a Link or a button", () => {
    const link = renderToStaticMarkup(<GhostButton href="/settings/senders">Reconnect</GhostButton>);
    expect(link).toMatch(/^<a /);
    for (const cls of ["h-9", "px-3", "ring-1", "ring-[var(--line)]", "hover:bg-[var(--surface-2)]", "text-[var(--ink)]"]) {
      expect(link, cls).toContain(cls);
    }
    expect(link).not.toContain("bg-[var(--ink)]");
    const button = renderToStaticMarkup(<GhostButton onClick={() => {}}>Dismiss</GhostButton>);
    expect(button).toMatch(/^<button type="button"/);
  });
});

describe("TextLink", () => {
  it("is an accent link underlined on hover only", () => {
    const html = renderToStaticMarkup(<TextLink href="/playbook">Open the playbook</TextLink>);
    expect(html).toMatch(/^<a /);
    expect(html).toContain("text-[var(--acc)]");
    expect(html).toContain("hover:underline");
    expect(html).not.toMatch(/class="[^"]*(^|\s)underline(\s|")/);
  });
});

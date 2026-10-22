import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WhatsWorkingStrip } from "./whats-working";

describe("WhatsWorkingStrip", () => {
  it("renders what replies more and less, with the evidence behind it", () => {
    const html = renderToStaticMarkup(
      createElement(WhatsWorkingStrip, {
        working: {
          evidence: 120,
          up: [{ label: "Funding signal", ratio: 2.1 }, { label: "Founders", ratio: 1.6 }],
          down: [{ label: "Managers", ratio: 0.5 }],
        },
      })
    );
    expect(html).toContain("from 120 invitations");
    expect(html).toContain("Funding signal 2.1× · Founders 1.6×");
    expect(html).toContain("Replying less: </span>Managers 0.5×");
  });

  it("omits an empty side", () => {
    const html = renderToStaticMarkup(
      createElement(WhatsWorkingStrip, { working: { evidence: 40, up: [{ label: "VPs", ratio: 1.3 }], down: [] } })
    );
    expect(html).not.toContain("Replying less");
  });
});

import { describe, expect, it } from "vitest";
import { validateToolInput, buildUserPrompt, TOTAL_INPUT_CAP } from "./validate";
import type { Tool } from "./registry";

const tool = {
  slug: "test",
  live: true,
  name: "Test",
  category: "Profile",
  icon: (() => null) as unknown,
  eyebrow: "",
  tagline: "",
  metaTitle: "",
  metaDescription: "",
  keywords: [],
  fields: [
    { name: "role", label: "Role", type: "text", required: true, maxLength: 20 },
    { name: "extra", label: "Extra", type: "text", required: false, maxLength: 10 },
    {
      name: "tone",
      label: "Tone",
      type: "select",
      required: false,
      maxLength: 40,
      options: [
        { value: "pro", label: "Pro" },
        { value: "bold", label: "Bold" },
      ],
    },
  ],
  cta: "",
  output: "variants",
  outputHeading: "",
  faqs: [],
  related: [],
} as unknown as Tool;

describe("validateToolInput", () => {
  it("rejects non-object bodies", () => {
    expect(validateToolInput(tool, null).ok).toBe(false);
    expect(validateToolInput(tool, "nope").ok).toBe(false);
  });

  it("requires required fields", () => {
    const r = validateToolInput(tool, { extra: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Role");
  });

  it("trims and keeps only known fields", () => {
    const r = validateToolInput(tool, { role: "  Founder  ", junk: "drop me" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.role).toBe("Founder");
      expect(r.values).not.toHaveProperty("junk");
    }
  });

  it("hard-caps a field at its maxLength instead of failing", () => {
    const r = validateToolInput(tool, { role: "x".repeat(50) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.role.length).toBe(20);
  });

  it("rejects an invalid select value", () => {
    const r = validateToolInput(tool, { role: "Founder", tone: "spicy" });
    expect(r.ok).toBe(false);
  });

  it("accepts a valid select value", () => {
    const r = validateToolInput(tool, { role: "Founder", tone: "bold" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.tone).toBe("bold");
  });

  it("enforces the global total input cap", () => {
    const big = {
      ...tool,
      fields: [{ name: "blob", label: "Blob", type: "text", required: true, maxLength: TOTAL_INPUT_CAP + 100 }],
    } as unknown as Tool;
    const r = validateToolInput(big, { blob: "x".repeat(TOTAL_INPUT_CAP + 50) });
    expect(r.ok).toBe(false);
  });

  it("buildUserPrompt serializes filled fields as Label: value lines", () => {
    const prompt = buildUserPrompt(tool, { role: "Founder", tone: "bold" });
    expect(prompt).toBe("Role: Founder\nTone: bold");
  });
});

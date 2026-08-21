import { z } from "zod";
import type { ToolOutput } from "./registry";

/**
 * Output schemas for the free tools — one per output mode. `generateObject` forces the
 * model to fill the matching schema, so the client renderers get validated, typed data.
 * These are server-side (used by the API route).
 */

export const variantsSchema = z.object({
  variants: z
    .array(
      z.object({
        label: z.string().describe("2-3 word style label for this variant"),
        text: z.string().describe("the generated copy"),
        tip: z.string().describe("one short line on why it works / when to use it"),
      }),
    )
    .min(3)
    .max(6),
});

export const booleanSchema = z.object({
  query: z.string().describe("the ready-to-paste Boolean search string"),
  explanation: z.string().describe("plain-language description of what it matches"),
  tips: z.array(z.string()).max(6).describe("short practical refinement tips"),
});

export const scoreSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.string().describe("one-word verdict, e.g. Strong / Solid / Needs work"),
  summary: z.string(),
  breakdown: z
    .array(
      z.object({
        label: z.string(),
        score: z.number().min(0).max(100),
        note: z.string(),
      }),
    )
    .min(3)
    .max(6),
  wins: z.array(z.string()).max(6),
  fixes: z.array(z.string()).max(8),
});

export const roastSchema = z.object({
  cringeScore: z.number().min(0).max(100),
  roast: z.array(z.string()).min(3).max(7),
  realTalk: z.array(z.string()).min(3).max(6),
});

export const OUTPUT_SCHEMAS = {
  variants: variantsSchema,
  boolean: booleanSchema,
  score: scoreSchema,
  roast: roastSchema,
} as const;

/** Rough output-token budget per mode — keeps free-tool spend bounded. */
export const OUTPUT_MAX_TOKENS: Record<ToolOutput, number> = {
  variants: 1200,
  boolean: 500,
  score: 1100,
  roast: 900,
};

export type VariantsResult = z.infer<typeof variantsSchema>;
export type BooleanResult = z.infer<typeof booleanSchema>;
export type ScoreResult = z.infer<typeof scoreSchema>;
export type RoastResult = z.infer<typeof roastSchema>;

export function schemaFor(output: ToolOutput) {
  return OUTPUT_SCHEMAS[output];
}

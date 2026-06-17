import { z } from "zod";

/** Meta's standard call-to-action buttons we expose for lead-gen / traffic ads. */
export const AD_CTAS = [
  "LEARN_MORE",
  "SIGN_UP",
  "GET_QUOTE",
  "CONTACT_US",
  "DOWNLOAD",
  "SUBSCRIBE",
  "GET_OFFER",
] as const;

/**
 * One generated ad concept. Lengths track Meta's recommended limits so a concept maps cleanly
 * onto a real ad: headline ≤40, primary text kept short (best practice ≪125 shown before "more"),
 * an optional link description. `creativePrompt` is the brief handed to the creative generator
 * (image/video) — it never reaches the prospect, so it isn't grounding-checked.
 */
export const adConceptSchema = z.object({
  headline: z.string().max(40),
  primaryText: z.string().max(150),
  description: z.string().max(40).optional(),
  cta: z.enum(AD_CTAS),
  creativePrompt: z.string().max(300),
});

export const adConceptBatchSchema = z.object({
  concepts: z.array(adConceptSchema),
});

export type AdConcept = z.infer<typeof adConceptSchema>;

import { z } from "zod";

export const callBriefSchema = z.object({
  opening_line: z.string().min(1).max(300),
  talking_points: z.array(z.string()).max(5),
  objection_handling: z.array(z.string()).max(5),
  goal_statement: z.string().min(1).max(200),
});

export type CallBriefOutput = z.infer<typeof callBriefSchema>;

export const CALL_OUTCOMES = [
  "booked",
  "callback",
  "not_interested",
  "no_answer",
  "voicemail",
  "do_not_call",
] as const;

export const callOutcomeSchema = z.object({ outcome: z.enum(CALL_OUTCOMES) });

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

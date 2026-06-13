import { z } from "zod";
import type { CopilotTool } from "@vantera/help-agent";

export const navigateTools: CopilotTool[] = [
  {
    name: "openPage",
    tier: "navigate",
    description:
      "Navigate the user to a page in the app. Use for 'take me to…' or to follow up an answer with the relevant screen.",
    parameters: z.object({
      route: z
        .string()
        .describe("App route, e.g. /review, /agents, /leads, /settings/channels"),
    }),
  },
  {
    name: "highlightElement",
    tier: "navigate",
    description:
      "Visually highlight a single element on the current page to point the user at it.",
    parameters: z.object({
      anchor: z
        .string()
        .describe(
          "A data-copilot anchor name, e.g. 'deploy-scout', 'approve-draft'",
        ),
    }),
  },
  {
    name: "startWalkthrough",
    tier: "navigate",
    description:
      "Walk the user step-by-step through a task by highlighting elements in sequence with short notes.",
    parameters: z.object({
      steps: z
        .array(z.object({ anchor: z.string(), note: z.string() }))
        .min(1),
    }),
  },
];

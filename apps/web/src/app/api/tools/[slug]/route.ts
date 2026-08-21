import { generateObject } from "ai";
import { getModel } from "@vantera/ai";
import { getLiveTool } from "@/lib/tools/registry";
import { TOOL_PROMPTS } from "@/lib/tools/prompts";
import { schemaFor, OUTPUT_MAX_TOKENS } from "@/lib/tools/schemas";
import { validateToolInput, buildUserPrompt } from "@/lib/tools/validate";
import { checkLimit, rateLimitResponse, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Public, unauthenticated AI endpoint powering the free LinkedIn tools. No session, no DB
 * — stateless generation only. Abuse is bounded by: per-IP burst + daily rate limits,
 * per-field + total input caps (validateToolInput), a small output-token budget, and a
 * cheap model. Every send-path guardrail elsewhere in the app is irrelevant here: nothing
 * this route produces reaches a prospect.
 */
const TOOLS_MODEL = process.env.TOOLS_AI_MODEL ?? "claude-haiku-4-5-20251001";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const tool = getLiveTool(slug);
  if (!tool) return json({ ok: false, error: "Unknown tool." }, 404);

  const system = TOOL_PROMPTS[slug];
  if (!system) return json({ ok: false, error: "This tool isn't available yet." }, 404);

  // Per-IP rate limits: short burst window + daily ceiling. Either tripping returns 429.
  const ip = clientIp(req);
  const burst = await checkLimit("tools", ip);
  const burstBlocked = rateLimitResponse(burst);
  if (burstBlocked) return burstBlocked;
  const daily = await checkLimit("toolsDaily", ip);
  const dailyBlocked = rateLimitResponse(daily);
  if (dailyBlocked) return dailyBlocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const inputs = (body as { inputs?: unknown })?.inputs;
  const validation = validateToolInput(tool, inputs);
  if (!validation.ok) return json({ ok: false, error: validation.error }, 400);

  const prompt = buildUserPrompt(tool, validation.values);

  try {
    const { object } = await generateObject({
      model: getModel(TOOLS_MODEL),
      schema: schemaFor(tool.output),
      system,
      prompt,
      maxOutputTokens: OUTPUT_MAX_TOKENS[tool.output],
    });
    return json({ ok: true, output: tool.output, result: object });
  } catch (err) {
    console.error(`[tools/${slug}] generation failed`, err);
    return json({ ok: false, error: "Something went wrong generating that. Please try again." }, 502);
  }
}

import { tasks } from "@trigger.dev/sdk";
import { createVoiceInfraFromEnv } from "@vantera/voice-infra";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const infra = createVoiceInfraFromEnv();
  if (!infra.verifyWebhook(headers, rawBody)) {
    return new Response("invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  await tasks.trigger("process-voice-webhook", { payload });
  return new Response("ok", { status: 200 });
}

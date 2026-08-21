import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Targeted rate limiting on abuse-prone routes (LLM copilot, public token endpoints),
// backed by Upstash Redis so limits hold across serverless instances. When the Upstash env
// is unset (local dev) limiting is a no-op — development never blocks. Production sets the
// env (see .env.example); coarse per-IP/path limits stay at the Vercel WAF layer.

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

let warned = false;
function warnUnconfigured(): void {
  if (warned) return;
  warned = true;
  console.warn("[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN unset — rate limiting disabled (dev fail-open)");
}

type Window = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

const CONFIGS = {
  // LLM copilot turn — per user id. Protects against token-burn / DoS.
  copilot: { tokens: 10, window: "60 s" as Window },
  // Copilot feedback writes — per user id.
  copilotFeedback: { tokens: 30, window: "60 s" as Window },
  // Public token endpoints (unsubscribe, conversion) — per IP. Generous so a real human
  // (one click) never trips it; only a hammering scanner does. Tokens are UUIDs, so this is depth.
  publicToken: { tokens: 60, window: "60 s" as Window },
  // Free public tools (unauthenticated AI generation) — per IP. Two tiers: a short burst
  // window stops rapid-fire token burn, a daily window caps sustained abuse of the LLM.
  tools: { tokens: 8, window: "60 s" as Window },
  toolsDaily: { tokens: 60, window: "1 d" as Window },
  // /start claim (journey v2) — account-creation vector; per-IP burst + per-email hourly.
  startClaim: { tokens: 5, window: "10 m" as Window },
  startClaimEmail: { tokens: 3, window: "1 h" as Window },
  // Reveal poll — per user id; the screen polls ~every 2s.
  revealStatus: { tokens: 60, window: "60 s" as Window },
  // Onboarding favicon peek — per user id; one guarded fetch per URL blur.
  faviconPeek: { tokens: 20, window: "60 s" as Window },
} as const;

export type LimitName = keyof typeof CONFIGS;

const limiters = new Map<LimitName, Ratelimit>();

function getLimiter(name: LimitName): Ratelimit | null {
  if (!redis) return null;
  let limiter = limiters.get(name);
  if (!limiter) {
    const cfg = CONFIGS[name];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.tokens, cfg.window),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

export interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms when the window resets
}

/** Check a named limit for an identity key. No-op success when Upstash is unconfigured. */
export async function checkLimit(name: LimitName, key: string): Promise<LimitResult> {
  const limiter = getLimiter(name);
  if (!limiter) {
    warnUnconfigured();
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  const r = await limiter.limit(key);
  return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
}

/** Build a 429 (with Retry-After) when a limit is exceeded; null when allowed. */
export function rateLimitResponse(result: LimitResult): Response | null {
  if (result.success) return null;
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return new Response("Too many requests", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "Cache-Control": "no-store",
    },
  });
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

# LinkedIn Connect + Inbound Webhook Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LinkedIn connect a clean redirect-back flow with existing-account-first framing, fix the broken hosted-auth request, and reconcile `parseEventWebhook` to the payload shapes Unipile actually sends so inbound events parse.

**Architecture:** Two parts in one branch. **Part A** (connect UX) is fully deterministic and shippable on its own: fix + extend the `linkedin-infra` hosted-auth call, add a pure redirect-URL helper, thread it through the channels server action, restyle the connect button/card, and update the help article. **Part B** (webhook reconciliation) is capture-gated: a live smoke capture (Task B1) records the real payloads, then `parseEventWebhook` is rewritten against them — discriminator by field presence, synthetic idempotency key (provider sends no `event_id`), `AccountStatus`→status mapping, and an `is_sender` echo guard. Nothing in Part B changes the `LinkedInEvent` output shape, so `inbound.ts` and the webhook route are untouched.

**Tech Stack:** TypeScript (strict), Vitest, Next.js App Router (Server Actions + RSC), pnpm workspaces. Spec: `docs/superpowers/specs/2026-06-15-linkedin-connect-redirect-design.md`.

---

## File structure

Part A:
- `packages/linkedin-infra/src/types.ts` — add `HostedAuthRedirects`; widen `createHostedAuthLink` signature.
- `packages/linkedin-infra/src/unipile.ts` — fix + extend `createHostedAuthLink`.
- `packages/linkedin-infra/src/unipile.test.ts` — adapter request-body tests.
- `packages/linkedin-infra/src/in-memory.ts` — fake accepts redirects.
- `apps/web/src/app/(app)/settings/channels/redirects.ts` (create) — `buildConnectRedirects` pure helper.
- `apps/web/src/app/(app)/settings/channels/redirects.test.ts` (create) — helper tests.
- `apps/web/src/app/(app)/settings/channels/actions.ts` — pass redirects into the adapter.
- `apps/web/src/app/(app)/settings/channels/channels-forms.tsx` — `variant` prop + same-tab nav.
- `apps/web/src/app/(app)/settings/channels/page.tsx` — primary/secondary layout + `?connected` banner.
- `packages/help-content/content/channels-setup.md` — connect-existing-first + return-to-app copy.

Part B:
- `apps/web/src/app/api/webhooks/linkedin/route.ts` — temporary raw-body log (Task B1, reverted in B5).
- `packages/linkedin-infra/src/unipile.ts` — rewrite `parseEventWebhook`.
- `packages/linkedin-infra/src/unipile.test.ts` — fixture-driven parser tests (payload constants).
- `packages/linkedin-infra/src/in-memory.ts` — realistic fake event payloads.

---

# Part A — Connect UX + hosted-auth fix

### Task A1: Widen the hosted-auth interface

**Files:**
- Modify: `packages/linkedin-infra/src/types.ts`

- [ ] **Step 1: Add the redirects type and widen the method**

In `packages/linkedin-infra/src/types.ts`, add above `LinkedInInfra`:

```ts
export interface HostedAuthRedirects {
  /** Absolute URL the browser returns to on success. */
  success: string;
  /** Absolute URL the browser returns to on failure/cancel. */
  failure: string;
}
```

Change the interface method from:

```ts
  createHostedAuthLink(accountId: string): Promise<HostedAuthLink>;
```

to:

```ts
  createHostedAuthLink(accountId: string, redirects?: HostedAuthRedirects): Promise<HostedAuthLink>;
```

- [ ] **Step 2: Type-check the package**

Run: `pnpm --filter @vantera/linkedin-infra type-check`
Expected: FAIL — `unipile.ts` and `in-memory.ts` no longer match the interface. (Fixed in A2/A3.)

- [ ] **Step 3: Commit**

```bash
git add packages/linkedin-infra/src/types.ts
git commit -m "feat(linkedin-infra): add HostedAuthRedirects to hosted-auth interface"
```

---

### Task A2: Fix + extend the Unipile hosted-auth request

The real `POST /api/v1/hosted/accounts/link` **requires** `type:"create"`, `api_url`, `expiresOn`, `providers`, and returns only `{ object, url }` (no `expires_at`). The current adapter sends none of the required fields and reads a non-existent `expires_at` — both bugs are fixed here. `bypass_success_screen:true` skips Unipile's branded success screen so the user lands straight back in-app (white-label, rule 04).

**Files:**
- Modify: `packages/linkedin-infra/src/unipile.ts`
- Test: `packages/linkedin-infra/src/unipile.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/linkedin-infra/src/unipile.test.ts`:

```ts
describe("createHostedAuthLink", () => {
  function makeInfra(captured: { body?: unknown } = {}) {
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ object: "HostedAuthUrl", url: "https://auth.example/x" }), { status: 200 });
    }) as unknown as typeof fetch;
    return new UnipileLinkedInInfra({ apiKey: "k", dsn: "api48.unipile.com:17854", webhookSecret: "s", fetchFn });
  }

  it("sends all provider-required fields", async () => {
    const captured: { body?: any } = {};
    const infra = makeInfra(captured);
    const link = await infra.createHostedAuthLink("acct-123");
    expect(link.url).toBe("https://auth.example/x");
    expect(captured.body.type).toBe("create");
    expect(captured.body.providers).toEqual(["LINKEDIN"]);
    expect(captured.body.api_url).toBe("https://api48.unipile.com:17854");
    expect(captured.body.name).toBe("acct-123");
    expect(captured.body.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(link.expiresAt).toBe(captured.body.expiresOn);
  });

  it("includes redirect urls and bypass flag when redirects are given", async () => {
    const captured: { body?: any } = {};
    const infra = makeInfra(captured);
    await infra.createHostedAuthLink("acct-123", {
      success: "https://app.test/settings/channels?connected=1",
      failure: "https://app.test/settings/channels?connected=failed",
    });
    expect(captured.body.success_redirect_url).toBe("https://app.test/settings/channels?connected=1");
    expect(captured.body.failure_redirect_url).toBe("https://app.test/settings/channels?connected=failed");
    expect(captured.body.bypass_success_screen).toBe(true);
  });

  it("omits redirect fields when none are given", async () => {
    const captured: { body?: any } = {};
    const infra = makeInfra(captured);
    await infra.createHostedAuthLink("acct-123");
    expect(captured.body.success_redirect_url).toBeUndefined();
    expect(captured.body.bypass_success_screen).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: FAIL — current body lacks `type`/`api_url`/`expiresOn`; return throws on missing `expires_at`.

- [ ] **Step 3: Rewrite `createHostedAuthLink`**

In `packages/linkedin-infra/src/unipile.ts`, add near the top:

```ts
const HOSTED_AUTH_TTL_MS = 60 * 60_000; // 1h; links also expire on Unipile's daily restart
```

Add the type import:

```ts
import type { HostedAuthLink, HostedAuthRedirects, InviteRequest, LinkedInEvent, LinkedInInfra, MessageRequest, SendOutcome } from "./types";
```

Replace the whole `createHostedAuthLink` method with:

```ts
  async createHostedAuthLink(accountId: string, redirects?: HostedAuthRedirects): Promise<HostedAuthLink> {
    const expiresOn = new Date(Date.now() + HOSTED_AUTH_TTL_MS).toISOString();
    const body: Record<string, unknown> = {
      type: "create",
      providers: ["LINKEDIN"],
      api_url: `https://${this.dsn}`,
      expiresOn,
      name: accountId,
    };
    if (redirects) {
      body.success_redirect_url = redirects.success;
      body.failure_redirect_url = redirects.failure;
      body.bypass_success_screen = true;
    }
    const data = await this.call<{ url?: unknown }>(PATH_HOSTED_AUTH, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { url: requireString(data.url, "url"), expiresAt: expiresOn };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: PASS (the three new tests; existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add packages/linkedin-infra/src/unipile.ts packages/linkedin-infra/src/unipile.test.ts
git commit -m "fix(linkedin-infra): send required hosted-auth fields + success/failure redirects"
```

---

### Task A3: Update the in-memory fake

**Files:**
- Modify: `packages/linkedin-infra/src/in-memory.ts`
- Test: `packages/linkedin-infra/src/in-memory.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/linkedin-infra/src/in-memory.test.ts`:

```ts
it("createHostedAuthLink accepts optional redirects and returns a url", async () => {
  const infra = new InMemoryLinkedInInfra();
  const link = await infra.createHostedAuthLink("acct-1", {
    success: "https://app.test/s?connected=1",
    failure: "https://app.test/s?connected=failed",
  });
  expect(link.url).toContain("acct-1");
  expect(typeof link.expiresAt).toBe("string");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @vantera/linkedin-infra test -- in-memory`
Expected: FAIL — current `createHostedAuthLink` takes one arg / signature mismatch.

- [ ] **Step 3: Update the fake**

In `packages/linkedin-infra/src/in-memory.ts`, change the method signature to match the interface (ignore the redirects in the fake, or record them for assertions):

```ts
  async createHostedAuthLink(accountId: string, _redirects?: HostedAuthRedirects): Promise<HostedAuthLink> {
    return { url: `https://fake-hosted-auth.local/${accountId}`, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
  }
```

Add `HostedAuthRedirects` to the type import at the top of the file.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @vantera/linkedin-infra test`
Expected: PASS (all package tests).

- [ ] **Step 5: Commit**

```bash
git add packages/linkedin-infra/src/in-memory.ts packages/linkedin-infra/src/in-memory.test.ts
git commit -m "feat(linkedin-infra): fake createHostedAuthLink accepts redirects"
```

---

### Task A4: `buildConnectRedirects` pure helper

**Files:**
- Create: `apps/web/src/app/(app)/settings/channels/redirects.ts`
- Test: `apps/web/src/app/(app)/settings/channels/redirects.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(app)/settings/channels/redirects.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildConnectRedirects } from "./redirects";

describe("buildConnectRedirects", () => {
  it("builds success and failure urls on the channels page", () => {
    expect(buildConnectRedirects("https://app.test")).toEqual({
      success: "https://app.test/settings/channels?connected=1",
      failure: "https://app.test/settings/channels?connected=failed",
    });
  });

  it("normalizes a trailing slash on the base url", () => {
    expect(buildConnectRedirects("https://app.test/").success).toBe(
      "https://app.test/settings/channels?connected=1",
    );
  });

  it("throws when the base url is empty", () => {
    expect(() => buildConnectRedirects("")).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web test -- redirects`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/app/(app)/settings/channels/redirects.ts`:

```ts
import type { HostedAuthRedirects } from "@vantera/linkedin-infra";

/** Build the hosted-auth return URLs from the app base url (APP_URL). */
export function buildConnectRedirects(appUrl: string): HostedAuthRedirects {
  if (!appUrl) throw new Error("APP_URL is not set");
  const base = appUrl.replace(/\/+$/, "");
  return {
    success: `${base}/settings/channels?connected=1`,
    failure: `${base}/settings/channels?connected=failed`,
  };
}
```

Confirm `@vantera/linkedin-infra` exports `HostedAuthRedirects` from `index.ts`; if not, add `export * from "./types"` coverage or an explicit re-export.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter web test -- redirects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/settings/channels/redirects.ts" "apps/web/src/app/(app)/settings/channels/redirects.test.ts"
git commit -m "feat(channels): buildConnectRedirects helper for hosted-auth return urls"
```

---

### Task A5: Thread redirects through the connect action

**Files:**
- Modify: `apps/web/src/app/(app)/settings/channels/actions.ts:150-178`

- [ ] **Step 1: Pass redirects into the adapter call**

In `createLinkedInConnectLink`, add the import at the top of the file:

```ts
import { buildConnectRedirects } from "./redirects";
```

Replace the `try` block that calls the adapter:

```ts
  try {
    const { url } = await createLinkedInInfraFromEnv().createHostedAuthLink(account.id);
    return { url };
  } catch {
    return { error: "Could not generate a connection link. Try again shortly." };
  }
```

with:

```ts
  try {
    const redirects = buildConnectRedirects(process.env.APP_URL ?? "http://localhost:3000");
    const { url } = await createLinkedInInfraFromEnv().createHostedAuthLink(account.id, redirects);
    return { url };
  } catch {
    return { error: "Could not generate a connection link. Try again shortly." };
  }
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter web type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/settings/channels/actions.ts"
git commit -m "feat(channels): return hosted-auth user to the app after connecting"
```

---

### Task A6: Connect button — variant + same-tab navigation

**Files:**
- Modify: `apps/web/src/app/(app)/settings/channels/channels-forms.tsx:206-230`

- [ ] **Step 1: Add a `variant` prop and switch to same-tab nav**

Replace the whole `LinkedInConnectButton` component with:

```tsx
export function LinkedInConnectButton({
  label = "Connect your LinkedIn account",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const [isPending, startTransition] = useTransition();
  const [connectError, setConnectError] = useState<string | null>(null);

  function handleConnect() {
    startTransition(async () => {
      setConnectError(null);
      const result = await createLinkedInConnectLink();
      if (result.error) {
        setConnectError(result.error);
      } else if (result.url) {
        // Same-tab redirect: the user signs in on LinkedIn's hosted page and is
        // returned to /settings/channels?connected=… (no stale second tab).
        window.location.assign(result.url);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={isPending} variant={variant}>
        {isPending ? "Preparing…" : label}
      </Button>
      {connectError && <p className="text-sm text-destructive">{connectError}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter web type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/settings/channels/channels-forms.tsx"
git commit -m "feat(channels): connect button supports variant + same-tab redirect"
```

---

### Task A7: Channels page — primary/secondary + return banner

**Files:**
- Modify: `apps/web/src/app/(app)/settings/channels/page.tsx:42-218`

- [ ] **Step 1: Read the `connected` search param**

Change the component signature and read the param. Next.js App Router passes `searchParams` as a Promise:

```tsx
export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const { connected } = await searchParams;
  const supabase = await createClient();
```

- [ ] **Step 2: Render the return banner above the LinkedIn card**

Immediately inside the returned `<div className="flex max-w-2xl flex-col gap-6">`, after the header block, add:

```tsx
      {connected === "1" && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
          LinkedIn connection submitted — your account will appear here in a moment.
        </div>
      )}
      {connected === "failed" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          That LinkedIn connection didn&apos;t complete. You can try connecting again below.
        </div>
      )}
```

- [ ] **Step 3: Make the empty-state primary and "another" secondary**

In the LinkedIn card, replace the empty-state block:

```tsx
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No LinkedIn account connected. Connect one to enable LinkedIn outreach.
              </p>
              <LinkedInConnectButton />
            </div>
```

with:

```tsx
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your own LinkedIn account to enable LinkedIn outreach. You&apos;ll sign in
                on LinkedIn&apos;s own page — we never see your password.
              </p>
              <LinkedInConnectButton variant="default" />
            </div>
```

And change the trailing "connect another" button (currently `<LinkedInConnectButton label="Connect another account" />`) to secondary styling:

```tsx
              <LinkedInConnectButton label="Connect another account" variant="ghost" />
```

Leave the per-row `Reconnect` button as `<LinkedInConnectButton label="Reconnect" variant="outline" />`.

- [ ] **Step 4: Verify build + type-check**

Run: `pnpm --filter web type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/settings/channels/page.tsx"
git commit -m "feat(channels): existing-account-first connect + return banner"
```

---

### Task A8: Help article (knowledge-sync, rule 09)

**Files:**
- Modify: `packages/help-content/content/channels-setup.md`

- [ ] **Step 1: Update the LinkedIn section**

In `packages/help-content/content/channels-setup.md`, replace the LinkedIn paragraph(s) with copy that states: connecting your **own existing** LinkedIn account is the primary path; you sign in on LinkedIn's page and are returned to Settings → Channels; the account shows as **Connecting** until confirmed, then **Active**; you can connect additional accounts from the same card. Keep it vendor-name-free. Concretely add:

```markdown
## Connecting LinkedIn

Connect your own existing LinkedIn account to turn on LinkedIn outreach. Click
**Connect your LinkedIn account** — you'll sign in on LinkedIn's own secure page (we
never see your password), then you're brought straight back to **Settings → Channels**.
Your account first shows as **Connecting** and flips to **Active** within a moment once
it's confirmed. Need more than one? Use **Connect another account** on the same card.
```

- [ ] **Step 2: Run the help-content tests (white-label guard)**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS (no vendor names).

- [ ] **Step 3: Commit**

```bash
git add packages/help-content/content/channels-setup.md
git commit -m "docs(help): connect-existing-first + return-to-app for LinkedIn"
```

- [ ] **Step 4: Part A gate**

Run: `pnpm lint && pnpm type-check && pnpm --filter @vantera/linkedin-infra test && pnpm --filter web test && pnpm --filter @vantera/help-content test`
Expected: all green. Part A is independently shippable here.

---

# Part B — Inbound webhook parser reconciliation

> Capture-gated. Task B1 records the real payloads; B2–B4 reconcile the parser against them. The parser's **output** (`LinkedInEvent`) does not change, so `inbound.ts` and the webhook route stay untouched — only field extraction inside `parseEventWebhook` changes.

### Task B1: Capture real payloads (verification gate)

**Files:**
- Modify (temporary): `apps/web/src/app/api/webhooks/linkedin/route.ts`

- [ ] **Step 1: Add a temporary raw-body log**

At the top of `POST` in `route.ts`, immediately after `const rawBody = await req.text();`, add:

```ts
  console.log("[linkedin-webhook-capture]", rawBody); // TEMP: remove in Task B5
```

- [ ] **Step 2: Deploy to a preview env and point the live webhooks at it**

Deploy `apps/web` to a Vercel preview (or run locally behind an ngrok tunnel). The three live webhooks already exist (ids in the spec). Temporarily repoint their `request_url` to the preview/tunnel `…/api/webhooks/linkedin` via `POST /api/v1/webhooks` (delete + recreate; there is no update endpoint), keeping the `x-unipile-secret` header = `UNIPILE_WEBHOOK_SECRET`.

- [ ] **Step 3: Trigger one of each event and record the raw bodies**

- `account_status`: connect a test LinkedIn account through the channels Connect button.
- `new_relation`: have the connected account's pending invite accepted (or send + accept one).
- `message_received`: send a DM to the connected account from another profile.

Copy the three logged `[linkedin-webhook-capture]` JSON bodies. **These are the source of truth** for the constants used in B2–B4. Also confirm two open questions from the logs:
  - Whether the tenant attribution value (the hosted-auth `name` = our accountId) arrives on the `account_status` body or only via a `notify_url` callback. If only via `notify_url`, open a follow-up to set `notify_url` on the hosted-auth link and handle that body — note it in the spec; do not expand this task.
  - The exact field path for the message sender's profile URL (e.g. `sender.attendee_profile_url`).

- [ ] **Step 4: Do NOT commit the capture log yet** (removed in B5). Record the captured JSON in the task notes / PR description.

---

### Task B2: Discriminator + reply path

**Files:**
- Modify: `packages/linkedin-infra/src/unipile.ts`
- Test: `packages/linkedin-infra/src/unipile.test.ts`

> The payload constants below are seeded from Unipile's documented field set. **Replace each with the matching captured JSON from B1** before finalizing; assertions are on our normalized output and stay the same.

- [ ] **Step 1: Write the failing reply test**

Add to `packages/linkedin-infra/src/unipile.test.ts`:

```ts
const REPLY_PAYLOAD = {
  webhook_name: "vantera-reply",
  account_id: "unipile-acct-1",
  message_id: "msg-1",
  provider_message_id: "urn:li:msg:1",
  message: "thanks for reaching out",
  timestamp: "2026-06-15T12:00:00.000Z",
  is_sender: false,
  sender: { attendee_profile_url: "https://www.linkedin.com/in/jane" },
};

describe("parseEventWebhook", () => {
  const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s" });

  it("parses an inbound reply", () => {
    expect(infra.parseEventWebhook(REPLY_PAYLOAD)).toEqual({
      type: "reply",
      providerEventId: "urn:li:msg:1",
      connectedAccountRef: "unipile-acct-1",
      fromProfileUrl: "https://www.linkedin.com/in/jane",
      body: "thanks for reaching out",
      receivedAt: "2026-06-15T12:00:00.000Z",
    });
  });

  it("ignores our own outbound message (is_sender true)", () => {
    expect(infra.parseEventWebhook({ ...REPLY_PAYLOAD, is_sender: true })).toBeNull();
  });

  it("returns null for a non-object payload", () => {
    expect(infra.parseEventWebhook(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: FAIL — current parser keys on `p.event`/`p.event_id`, returns null.

- [ ] **Step 3: Rewrite the discriminator + reply branch**

In `packages/linkedin-infra/src/unipile.ts`, replace the whole `parseEventWebhook` method body with a field-presence discriminator and the reply branch (other branches added in B3/B4):

```ts
  parseEventWebhook(payload: unknown): LinkedInEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;

    const connectedAccountRef = p.account_id != null ? String(p.account_id) : null;
    if (!connectedAccountRef) return null;

    // ── reply (messaging / message_received) ──
    if (typeof p.message === "string") {
      if (p.is_sender === true) return null; // our own outbound message echoed back
      const sender = p.sender as Record<string, unknown> | undefined;
      const fromProfileUrl = typeof sender?.attendee_profile_url === "string" ? sender.attendee_profile_url : null;
      const receivedAt = typeof p.timestamp === "string" ? p.timestamp : null;
      const eventId =
        (typeof p.provider_message_id === "string" && p.provider_message_id) ||
        (typeof p.message_id === "string" && p.message_id) ||
        null;
      if (!fromProfileUrl || !receivedAt || !eventId) return null;
      return { type: "reply", providerEventId: eventId, connectedAccountRef, fromProfileUrl, body: p.message, receivedAt };
    }

    return null; // other branches added in B3/B4
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: PASS (reply + is_sender + non-object tests).

- [ ] **Step 5: Commit**

```bash
git add packages/linkedin-infra/src/unipile.ts packages/linkedin-infra/src/unipile.test.ts
git commit -m "fix(linkedin-infra): parse real message_received payload + is_sender guard"
```

---

### Task B3: relationship_accepted path

**Files:**
- Modify: `packages/linkedin-infra/src/unipile.ts`
- Test: `packages/linkedin-infra/src/unipile.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `parseEventWebhook` describe block:

```ts
const RELATION_PAYLOAD = {
  webhook_name: "vantera-relationship-accepted",
  account_id: "unipile-acct-1",
  user_provider_id: "li-user-9",
  user_profile_url: "https://www.linkedin.com/in/jane",
  timestamp: "2026-06-15T12:30:00.000Z",
};

it("parses an accepted connection request", () => {
  expect(infra.parseEventWebhook(RELATION_PAYLOAD)).toEqual({
    type: "relationship_accepted",
    providerEventId: "unipile-acct-1:li-user-9:2026-06-15T12:30:00.000Z",
    connectedAccountRef: "unipile-acct-1",
    profileUrl: "https://www.linkedin.com/in/jane",
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: FAIL — relation payload currently returns null.

- [ ] **Step 3: Add the branch**

In `parseEventWebhook`, insert before the final `return null;`:

```ts
    // ── relationship accepted (users / new_relation) ──
    if (typeof p.user_profile_url === "string") {
      const providerId = typeof p.user_provider_id === "string" ? p.user_provider_id : p.user_profile_url;
      const ts = typeof p.timestamp === "string" ? p.timestamp : "";
      return {
        type: "relationship_accepted",
        providerEventId: `${connectedAccountRef}:${providerId}:${ts}`,
        connectedAccountRef,
        profileUrl: p.user_profile_url,
      };
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/linkedin-infra/src/unipile.ts packages/linkedin-infra/src/unipile.test.ts
git commit -m "fix(linkedin-infra): parse real new_relation payload"
```

---

### Task B4: account_status path + status mapping

**Files:**
- Modify: `packages/linkedin-infra/src/unipile.ts`
- Test: `packages/linkedin-infra/src/unipile.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the describe block (field names — `AccountStatus`, `name`, `account_id` — confirmed in B1; adjust if capture differs):

```ts
const STATUS_OK = {
  webhook_name: "vantera-account-status",
  account_id: "unipile-acct-1",
  name: "vantera-account-uuid",
  AccountStatus: "CREATION_SUCCESS",
  timestamp: "2026-06-15T13:00:00.000Z",
};

it("maps a successful account status to active", () => {
  expect(infra.parseEventWebhook(STATUS_OK)).toEqual({
    type: "account_status",
    providerEventId: "unipile-acct-1:CREATION_SUCCESS:2026-06-15T13:00:00.000Z",
    connectedAccountRef: "unipile-acct-1",
    status: "active",
    profileUrl: null,
    displayName: null,
    vanteraAccountId: "vantera-account-uuid",
  });
});

it("maps a fault account status to disconnected", () => {
  const out = infra.parseEventWebhook({ ...STATUS_OK, AccountStatus: "CREDENTIALS" });
  expect(out?.type).toBe("account_status");
  if (out?.type === "account_status") expect(out.status).toBe("disconnected");
});

it("returns null for a transient connecting status", () => {
  expect(infra.parseEventWebhook({ ...STATUS_OK, AccountStatus: "CONNECTING" })).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: FAIL.

- [ ] **Step 3: Add the branch + mapping**

Add the mapping constant near the top of `unipile.ts`:

```ts
const ACTIVE_STATUSES = new Set(["CREATION_SUCCESS", "OK", "RECONNECTED", "SYNC_SUCCESS"]);
const DISCONNECTED_STATUSES = new Set(["CREDENTIALS", "PERMISSIONS", "ERROR", "DELETED", "STOPPED"]);
```

Insert this branch in `parseEventWebhook` before the final `return null;`:

```ts
    // ── account status (account_status source) ──
    if (typeof p.AccountStatus === "string") {
      const raw = p.AccountStatus;
      let status: "active" | "disconnected";
      if (ACTIVE_STATUSES.has(raw)) status = "active";
      else if (DISCONNECTED_STATUSES.has(raw)) status = "disconnected";
      else return null; // transient (e.g. CONNECTING) — ignore
      const ts = typeof p.timestamp === "string" ? p.timestamp : "";
      return {
        type: "account_status",
        providerEventId: `${connectedAccountRef}:${raw}:${ts}`,
        connectedAccountRef,
        status,
        profileUrl: typeof p.profile_url === "string" ? p.profile_url : null,
        displayName: typeof p.display_name === "string" ? p.display_name : null,
        vanteraAccountId: typeof p.name === "string" ? p.name : null,
      };
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vantera/linkedin-infra test -- unipile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/linkedin-infra/src/unipile.ts packages/linkedin-infra/src/unipile.test.ts
git commit -m "fix(linkedin-infra): parse account_status (AccountStatus) + status mapping"
```

---

### Task B5: Realistic fake payloads + remove capture log

**Files:**
- Modify: `packages/linkedin-infra/src/in-memory.ts`
- Modify: `apps/web/src/app/api/webhooks/linkedin/route.ts`
- Test: `packages/jobs/src/pipeline/inbound.test.ts` (run only — should already pass)

- [ ] **Step 1: Align the fake's emitted payloads to the real shapes**

If `InMemoryLinkedInInfra` constructs sample webhook payloads (for `parseEventWebhook` round-trips in tests), update them to the real field names used in B2–B4 (`message`/`sender.attendee_profile_url`/`is_sender`, `user_profile_url`, `AccountStatus`/`name`). The fake's `parseEventWebhook` must produce the same `LinkedInEvent` output as the adapter for equivalent inputs.

- [ ] **Step 2: Remove the temporary capture log**

In `apps/web/src/app/api/webhooks/linkedin/route.ts`, delete the `console.log("[linkedin-webhook-capture]", rawBody);` line added in B1.

- [ ] **Step 3: Run the inbound + suppression guard tests**

Run: `pnpm --filter @vantera/jobs test -- inbound`
Expected: PASS — inbound handling (relationship_accepted → connected, reply → classify/suppress) still works against the new event shapes; the rule-11 suppression guard stays green.

- [ ] **Step 4: Commit**

```bash
git add packages/linkedin-infra/src/in-memory.ts "apps/web/src/app/api/webhooks/linkedin/route.ts"
git commit -m "chore(linkedin): realistic fake payloads; drop capture log"
```

---

### Task B6: Full gate + audits

- [ ] **Step 1: Run the full monorepo gate**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all green. (If `pnpm build` can't fetch Google Fonts offline, note it and rely on CI for `next build`, per the roadmap.)

- [ ] **Step 2: Whitelabel audit on the touched surfaces**

Dispatch the `whitelabel-auditor` subagent on the diff (channels page/forms, help article, linkedin-infra). Expected: no vendor names reach a user-facing surface.

- [ ] **Step 3: Re-point the live webhooks back to production**

If B1 repointed the live webhooks to a preview/tunnel, recreate them against `https://vanterasystem.dev/api/webhooks/linkedin` (prod, rule 10) with the `x-unipile-secret` header. Verify a real connect now flips the account to **Active** in Settings → Channels and a real reply lands in the review/inbound flow.

- [ ] **Step 4: Final commit if any audit fixes were needed**

```bash
git add -A
git commit -m "chore(linkedin): whitelabel + smoke fixes"
```

---

## Out of scope (tracked separately)
- Hosted-auth custom-domain assertion (audit follow-up 2b).
- `scheduled_sends` `linkedin_stage` CHECK migration (audit follow-up 2a).
- Onboarding connect step (decided: dashboard scope only).
- `notify_url`-based attribution handling — only if B1 shows `account_status` doesn't carry the `name`.

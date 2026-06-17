import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, Eyebrow } from "@/components/ui/panel";

type ResponderConfig = {
  cta?: string;
  sendMode?: "auto" | "review";
  slaMinutes?: number;
  sources?: { formFill?: boolean; websiteVisitor?: boolean; signal?: boolean };
  intakeId?: string;
};

type InboundRow = {
  id: string;
  source: string;
  email: string | null;
  status: string;
  received_at: string;
};

const SOURCE_LABELS: Record<string, string> = {
  formFill: "Form fills",
  websiteVisitor: "Website visitors",
  signal: "Buying signals",
  form_fill: "Form fill",
  website_visitor: "Website visitor",
};

const STATUS_TONE: Record<string, string> = {
  responded: "text-emerald-600",
  review: "text-amber-600",
  rejected: "text-muted-foreground",
  suppressed: "text-muted-foreground",
  received: "text-muted-foreground",
  error: "text-red-600",
};

export default async function ResponderAgentPage() {
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, status, config")
    .eq("kind", "responder")
    .limit(1)
    .maybeSingle<{ id: string; name: string; status: string; config: ResponderConfig | null }>();
  if (!agent) redirect("/agents");

  const { data: recent } = await supabase
    .from("inbound_leads")
    .select("id, source, email, status, received_at")
    .eq("agent_id", agent.id)
    .order("received_at", { ascending: false })
    .limit(10);
  const rows = (recent as InboundRow[] | null) ?? [];

  const config = agent.config ?? {};
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const webhookUrl = config.intakeId
    ? `${host ? `${proto}://${host}` : ""}/api/webhooks/inbound/${config.intakeId}`
    : null;

  const activeSources = Object.entries(config.sources ?? {})
    .filter(([, on]) => on)
    .map(([key]) => SOURCE_LABELS[key] ?? key);
  const live = agent.status === "live";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Eyebrow>Responder Agent</Eyebrow>
          <h1 className="font-heading mt-3 flex items-center gap-2 text-3xl font-semibold tracking-tight">
            {agent.name}
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${live ? "text-emerald-600" : "text-muted-foreground"}`}>
              <span className={`size-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40"}`} />
              {live ? "Live" : agent.status === "paused" ? "Paused" : "Draft"}
            </span>
          </h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/agents">← All agents</Link>
        </Button>
      </div>

      <Panel className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-base font-semibold">Connect your inbound source</h2>
          <p className="text-sm text-muted-foreground">
            POST a lead here the moment it arrives — speed is the edge. Sign the raw request body
            with HMAC-SHA256 using your signing secret and send it as the{" "}
            <code className="text-[11px]">X-Vantera-Signature: sha256=…</code> header.
          </p>
        </div>
        {webhookUrl ? (
          <code className="break-all rounded-xl border border-black/[0.06] bg-black/[0.03] px-3 py-2 text-xs dark:border-white/[0.08] dark:bg-white/[0.04]">
            {webhookUrl}
          </code>
        ) : (
          <p className="text-sm text-muted-foreground">Webhook endpoint unavailable — redeploy to regenerate it.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Your signing secret was shown once when you deployed this agent. If you didn&apos;t save
          it, redeploy to roll a new one.
        </p>
      </Panel>

      <Panel className="mb-4 flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold">Configuration</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Reply goal</dt>
          <dd>{config.cta ?? "—"}</dd>
          <dt className="text-muted-foreground">Responds within</dt>
          <dd>{config.slaMinutes ?? 5} min</dd>
          <dt className="text-muted-foreground">Mode</dt>
          <dd>{config.sendMode === "auto" ? "Automatic (clean replies send within SLA)" : "Review every reply"}</dd>
          <dt className="text-muted-foreground">Sources</dt>
          <dd className="flex flex-wrap gap-1.5">
            {activeSources.length
              ? activeSources.map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))
              : "—"}
          </dd>
        </dl>
      </Panel>

      <Panel className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-base font-semibold">Recent inbound</h2>
          <p className="text-sm text-muted-foreground">
            Every inbound lead, qualified against your Prospect Agent&apos;s bar.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No inbound leads yet. Once your form starts posting here, they&apos;ll appear in real time.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{r.email ?? "(no email)"}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{SOURCE_LABELS[r.source] ?? r.source}</span>
                  <span className={STATUS_TONE[r.status] ?? "text-muted-foreground"}>{r.status}</span>
                  <span>{new Date(r.received_at).toLocaleDateString()}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

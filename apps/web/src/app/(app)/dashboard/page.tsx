import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Inbox,
  Mail,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
import { ProspectPanel, type Prospect } from "./prospect-panel";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function timeUntil(iso: string | null): string {
  if (!iso) return "within ~15 min";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ~${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ~${hrs}h`;
  return `in ~${Math.round(hrs / 24)}d`;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function timeAgo(iso: string | null): string {
  if (!iso) return "no runs yet";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type ReplyRow = {
  id: string;
  channel: "email" | "linkedin";
  body: string | null;
  received_at: string;
  lead_id: string;
  leads: LeadProfile | null;
};

export default async function DashboardPage() {
  const { user, account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();
  const weekAgo = isoDaysAgo(7);

  // RLS scopes every query to this account (rule 02) — no account id is passed.
  const leadCount = (statuses?: string[]) => {
    let q = supabase.from("leads").select("id", { count: "exact", head: true });
    if (statuses) q = q.in("status", statuses);
    return q;
  };

  const [
    { data: agents },
    totalRes,
    qualifiedRes,
    outreachRes,
    repliedRes,
    convertedRes,
    draftsRes,
    interestedRes,
    { data: recentReplies },
    { data: mailboxes },
    { data: linkedinAccounts },
    { data: weekSends },
    repliesWeekRes,
    { data: prospects },
  ] = await Promise.all([
    supabase
      .from("agents")
      .select("id, kind, name, status, last_run_at, next_run_at")
      .order("created_at", { ascending: true }),
    leadCount(),
    leadCount(["qualified", "enriched"]),
    leadCount(["in_campaign"]),
    leadCount(["replied", "converted"]),
    leadCount(["converted"]),
    supabase
      .from("scheduled_sends")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("classification", "interested"),
    supabase
      .from("replies")
      .select(`id, channel, body, received_at, lead_id, leads(${LEAD_PROFILE_FIELDS})`)
      .eq("classification", "interested")
      .order("received_at", { ascending: false })
      .limit(4)
      .returns<ReplyRow[]>(),
    supabase.from("mailboxes").select("status"),
    supabase.from("linkedin_accounts").select("status"),
    supabase.from("outreach_sends").select("channel").gte("sent_at", weekAgo),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .gte("received_at", weekAgo),
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, title, company_name, company_domain, company_size, industry, location, tech_stack, status, ai_score, ai_rationale, ai_insights, email, email_status, phone, phone_status, linkedin_url"
      )
      .in("status", ["qualified", "enriched", "in_campaign", "replied", "converted"])
      .order("ai_score", { ascending: false, nullsFirst: false })
      .limit(6)
      .returns<Prospect[]>(),
  ]);

  const total = totalRes.count ?? 0;
  const qualified = qualifiedRes.count ?? 0;
  const inOutreach = outreachRes.count ?? 0;
  const replied = repliedRes.count ?? 0;
  const converted = convertedRes.count ?? 0;
  const drafts = draftsRes.count ?? 0;
  const interested = interestedRes.count ?? 0;

  const scout = agents?.find((a) => a.kind === "scout") ?? null;
  const liveAgents = (agents ?? []).filter((a) => a.status === "live");
  const goal = account.revenue_goal_cents ? usd.format(account.revenue_goal_cents / 100) : null;
  const firstName = user?.email?.split("@")[0] ?? "there";

  // Channel readiness — can the pipeline actually send?
  const mbActive = (mailboxes ?? []).filter((m) => m.status === "active").length;
  const mbWarming = (mailboxes ?? []).filter((m) => m.status === "warming").length;
  const mbTotal = (mailboxes ?? []).length;
  const liStatus = (linkedinAccounts ?? [])[0]?.status ?? null;

  // This week's momentum
  const sendsWeek = (weekSends ?? []).length;
  const emailWeek = (weekSends ?? []).filter((s) => s.channel === "email").length;
  const liWeek = (weekSends ?? []).filter((s) => s.channel === "linkedin").length;
  const repliesWeek = repliesWeekRes.count ?? 0;

  // State machine: an activation ramp before the first agent is live with no
  // leads yet; the working dashboard once either condition is met.
  const isNew = liveAgents.length === 0 && total === 0;

  const funnel = [
    { label: "Sourced", count: total, href: "/leads" },
    { label: "Qualified", count: qualified, href: "/leads?tab=qualified" },
    { label: "In outreach", count: inOutreach, href: "/leads?tab=in_campaign" },
    { label: "Replied", count: replied, href: "/leads?tab=replied" },
    { label: "Converted", count: converted, href: "/leads?tab=replied" },
  ];
  const reached = funnel.filter((s) => s.count > 0).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good to see you, {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            Targeting <span className="font-medium text-foreground">{account.onboarding_icp}</span>{" "}
            in <span className="font-medium text-foreground">{account.onboarding_industry}</span>
            {goal && (
              <>
                {" "}
                — goal <span className="font-medium text-foreground">{goal}/mo</span>
              </>
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Edit goal</Link>
        </Button>
      </header>

      {isNew ? (
        <ActivationRamp scoutDeployed={Boolean(scout)} goal={goal} />
      ) : (
        <>
          {/* One primary action, state-dependent */}
          {drafts > 0 ? (
            <Card className="border-foreground/15 bg-muted/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                    <Inbox className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {drafts} {drafts === 1 ? "draft is" : "drafts are"} waiting for your review
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Nothing sends until you approve it. A few minutes keeps the pipeline moving.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link href="/review">
                    Review now <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">You&apos;re all caught up</p>
                    <p className="text-sm text-muted-foreground">
                      {liveAgents.length > 0
                        ? `Your agent runs ${timeUntil(scout?.next_run_at ?? null)} — new drafts land here as leads qualify.`
                        : "Deploy an Outreach Agent to start drafting personalized outreach."}
                    </p>
                  </div>
                </div>
                {liveAgents.length === 0 && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/agents">View agents</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pipeline funnel — real counts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5">
                {funnel.map((stage) => (
                  <Link
                    key={stage.label}
                    href={stage.href}
                    className="group flex flex-col gap-1 bg-card px-4 py-4 transition-colors hover:bg-muted"
                  >
                    <span className="font-mono text-2xl font-semibold tabular-nums">{stage.count}</span>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">
                      {stage.label}
                    </span>
                  </Link>
                ))}
              </div>
              <AnimatedProgress value={(reached / funnel.length) * 100} className="mt-4" />
              <p className="mt-2 text-xs text-muted-foreground">
                {converted > 0
                  ? `${converted} ${converted === 1 ? "lead" : "leads"} converted toward your ${goal ?? "revenue"} goal.`
                  : "Leads flow left to right as your agents work. Revenue tracking arrives with Analytics."}
              </p>
            </CardContent>
          </Card>

          {/* Recent prospects — what the Prospect Agent pulled + enriched */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Recent prospects</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Sourced, scored, and enriched by your Prospect Agent — click any row for the full profile.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/leads">
                  View all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ProspectPanel prospects={prospects ?? []} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Agent heartbeat — silence reads as working, not broken */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your agents</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {(agents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agents deployed yet.</p>
                ) : (
                  (agents ?? []).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${
                            a.status === "live" ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40"
                          }`}
                          aria-hidden
                        />
                        <span className="text-sm font-medium">{a.name}</span>
                        <Badge variant="secondary" className="capitalize">
                          {a.kind === "scout" ? "Prospect" : "Outreach"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {a.status === "live"
                          ? `next run ${timeUntil(a.next_run_at)}`
                          : a.status === "paused"
                            ? "paused"
                            : "draft"}
                      </span>
                    </div>
                  ))
                )}
                {scout?.status === "live" && (
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    Last sourced {timeAgo(scout.last_run_at)}. Quiet stretches are normal — your agent
                    only keeps high-quality leads.
                  </p>
                )}
                <Button asChild variant="ghost" size="sm" className="-mx-2 mt-1 justify-start">
                  <Link href="/agents">
                    Manage agents <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Warm replies — the number that matters most */}
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Warm replies</CardTitle>
                {interested > 0 && <Badge variant="secondary">{interested}</Badge>}
              </CardHeader>
              <CardContent>
                {!recentReplies || recentReplies.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <Sparkles className="size-6 text-muted-foreground" />
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Interested replies show up here the moment they land. This is the number that
                      matters most.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {recentReplies.map((r, i) => {
                      const name =
                        [r.leads?.first_name, r.leads?.last_name].filter(Boolean).join(" ") ||
                        "A prospect";
                      const fresh = i === 0;
                      return (
                        <li key={r.id}>
                          <LeadProfileLink
                            lead={r.leads}
                            className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted ${
                              fresh ? "bg-muted/60" : ""
                            }`}
                          >
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              {r.channel === "email" ? (
                                <Mail className="size-3.5" />
                              ) : (
                                <MessageSquare className="size-3.5" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">{name}</span>
                                {fresh && (
                                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                    New
                                  </Badge>
                                )}
                                {r.leads?.company_name && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {r.leads.company_name}
                                  </span>
                                )}
                                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                  {timeAgo(r.received_at)}
                                </span>
                              </span>
                              {r.body && (
                                <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                  {r.body}
                                </span>
                              )}
                            </span>
                          </LeadProfileLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Channels — readiness of the send infrastructure */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Channels</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ChannelRow
                  icon={<Mail className="size-4" />}
                  label="Email"
                  ready={mbActive > 0}
                  detail={
                    mbTotal === 0
                      ? "Not set up"
                      : [mbActive ? `${mbActive} active` : null, mbWarming ? `${mbWarming} warming` : null]
                          .filter(Boolean)
                          .join(" · ")
                  }
                />
                <ChannelRow
                  icon={<MessageSquare className="size-4" />}
                  label="LinkedIn"
                  ready={liStatus === "active"}
                  detail={
                    liStatus === "active"
                      ? "Connected"
                      : liStatus === "restricted"
                        ? "Restricted"
                        : liStatus
                          ? "Connecting"
                          : "Not connected"
                  }
                />
                <Button asChild variant="ghost" size="sm" className="-mx-2 mt-1 justify-start">
                  <Link href="/settings/channels">
                    Manage channels <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* This week — momentum proof */}
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">This week</CardTitle>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="size-3.5" /> last 7 days
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-mono text-2xl font-semibold tabular-nums">{sendsWeek}</span>
                    <p className="text-xs text-muted-foreground">Messages sent</p>
                  </div>
                  <div>
                    <span className="font-mono text-2xl font-semibold tabular-nums">{repliesWeek}</span>
                    <p className="text-xs text-muted-foreground">Replies in</p>
                  </div>
                </div>
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  {sendsWeek > 0
                    ? `${emailWeek} email · ${liWeek} LinkedIn`
                    : "No sends yet this week — drafts you approve are sent here."}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function ChannelRow({
  icon,
  label,
  detail,
  ready,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {detail}
        <span
          className={`size-2 rounded-full ${ready ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          aria-hidden
        />
      </span>
    </div>
  );
}

function ActivationRamp({ scoutDeployed, goal }: { scoutDeployed: boolean; goal: string | null }) {
  // Endowed progress: two steps already done before they arrive here.
  const steps = [
    { label: "Create your account", done: true },
    { label: "Set your industry, ICP, and revenue goal", done: true },
    { label: "Deploy your Prospect Agent", done: scoutDeployed, current: !scoutDeployed },
    { label: "Get your first reply", done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <Card data-copilot="dashboard-checklist">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            You&apos;re {doneCount}/{steps.length} of the way to your first reply
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AnimatedProgress value={(doneCount / steps.length) * 100} />
          <ul className="flex flex-col gap-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                {s.done ? (
                  <CheckCircle2 className="size-4 text-foreground" />
                ) : (
                  <Circle className={`size-4 ${s.current ? "text-foreground" : "text-muted-foreground/50"}`} />
                )}
                <span className={s.done ? "" : s.current ? "font-medium" : "text-muted-foreground"}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-1 w-fit">
            <Link href="/agents/new/scout">
              Deploy your Prospect Agent <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What happens next</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Once live, your Prospect Agent sources companies that fit your ICP, scores them, and keeps
            only the high-quality ones — its first run starts within ~15 minutes.
          </p>
          <p>
            Add an Outreach Agent and qualified leads turn into personalized drafts, waiting in your
            review queue. Nothing sends until you approve it.
          </p>
          {goal && (
            <p className="border-t pt-3 text-foreground">
              Every reply and meeting is measured against your{" "}
              <span className="font-medium">{goal}/mo</span> goal.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGateData } from "@/lib/auth/context";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const { account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const goal = account.revenue_goal_cents ? usd.format(account.revenue_goal_cents / 100) : null;

  const checklist = [
    { label: "Create your account", done: true, note: null },
    { label: "Set your industry, ICP, and revenue goal", done: true, note: null },
    { label: "Launch your first campaign", done: false, note: "Coming soon" },
    { label: "Get your first reply", done: false, note: "After your first campaign" },
  ];
  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">
            Targeting <span className="font-medium">{account.onboarding_icp}</span> in{" "}
            <span className="font-medium">{account.onboarding_industry}</span>
            {goal && (
              <>
                {" "}
                — goal <span className="font-medium">{goal}/mo</span>
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every campaign is measured against this. Edit it anytime in Settings.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Getting started — {doneCount}/{checklist.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  {item.done ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
                  {item.note && <Badge variant="secondary">{item.note}</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SDR Prospect Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />
              <span className="text-sm font-medium">Standing by</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your agent goes Live when your first campaign launches — it will prospect, score,
              and reach out to only high-quality leads matching your ICP.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Loader2, Link2, Search } from "lucide-react";
import {
  savePersonalize,
  createOnboardingConnectLink,
  findFirstLeads,
  type FindLeadsState,
  type PersonalizeState,
} from "./actions";
import type { PlayCard } from "@/lib/plays";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { cn } from "@/lib/utils";

export type WizardInit = {
  initialStep: number; // 0 personalize · 1 connect · 2 confirmation
  connected: boolean;
  connectFailed: boolean;
  scan: { headline: string; summary: string } | null;
  /** Vera's matched starter plays (server-computed, honest source labels) */
  plays: PlayCard[];
  values: {
    companyName: string;
    role: string;
    websiteUrl: string;
    linkedinUrl: string;
    industry: string;
    icp: string;
    revenueGoal: string;
    avgDealValue: string;
    valueProp: string;
    bookingUrl: string;
  };
};

const ROLES = ["Founder / CEO", "Sales", "Marketing", "RevOps", "Agency / Consultant", "Other"];
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** The left rail's top-to-bottom pipeline. Index 0 is the endowed head start. */
const PIPELINE = [
  { title: "Account created", desc: "You're in — workspace ready." },
  { title: "Personalize", desc: "Your company, role, and website." },
  { title: "Connect LinkedIn", desc: "Secure hosted login. We never see your password." },
  { title: "Confirm targeting", desc: "Approve who your agents pursue." },
];

const STEP_LABELS = ["Personalize", "Connect", "Confirm"];

type ScanResult = { headline: string; suggested_icp: string; scope_of_industry: string };
type Analysis = { domain: string; done: boolean; scan: ScanResult | null };

/** The tracker always holds long enough to read as real work — never a flash. */
const MIN_ANALYSIS_MS = 3600;

/** Real work, narrated: the stages of savePersonalize's server-side site analysis. */
function analysisStages(domain: string) {
  return [
    { label: "Saving your workspace", sub: "Your account home, under your name" },
    { label: `Fetching ${domain}`, sub: "Pulling your live site" },
    { label: "Reading what you sell", sub: "Offerings, value props, positioning" },
    { label: "Finding your best-fit buyer", sub: "The persona your agents will pursue" },
  ];
}

const FIELD =
  "h-11 w-full rounded-xl border border-[rgba(12,16,26,0.12)] bg-white px-4 text-[15px] text-foreground " +
  "placeholder:text-[var(--ink-4)] transition-colors " +
  "focus-visible:border-[var(--cyan-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(11,87,171,0.2)]";

const DARK_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#0a0c12] px-6 py-3 text-[15px] font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(11,87,171,0.55)] disabled:opacity-60 disabled:hover:translate-y-0";

const GHOST_BTN =
  "inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-[14px] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground";

// Height-collapse panel swap: the outgoing panel folds shut, then the incoming one
// unfolds — the "form collapses, analysis runs" motion. The card has overflow-hidden,
// so height animates cleanly between auto measurements.
const contentVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: "auto", transition: { duration: 0.45, ease: EASE } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.32, ease: EASE } },
};

function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-5 -z-10 rounded-[2.5rem] blur-2xl"
      style={{ background: "radial-gradient(55% 60% at 50% 0%, rgba(11,87,171,0.18), transparent 70%)" }}
    />
  );
}

export function Wizard({ init }: { init: WizardInit }) {
  const [step, setStep] = useState(init.initialStep);
  const [values, setValues] = useState(init.values);
  const [scanHeadline, setScanHeadline] = useState(init.scan?.headline ?? "");
  const [plays, setPlays] = useState<PlayCard[]>(init.plays);

  const [findState, findAction, finding] = useActionState<FindLeadsState, FormData>(findFirstLeads, {});
  const [connecting, startConnect] = useTransition();
  const [connectError, setConnectError] = useState(init.connectFailed ? "LinkedIn didn't connect — try again." : "");
  const [savingPersonalize, startSaving] = useTransition();
  const [personalizeError, setPersonalizeError] = useState("");

  // The live analysis tracker. Set the moment Personalize submits with a website; stage
  // pacing is timed while the real scan runs server-side; `done` lands with the result.
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [stageIdx, setStageIdx] = useState(0);

  // Whether the confirmation fields were actually derived from a website scan. When no
  // site was given (or the scan failed), the "Pulled from your site" hint is misleading
  // and the user faces empty required fields cold — so the copy adapts to guide them.
  const derivedFromSite = Boolean(init.scan || analysis?.scan);

  // Pace the tracker through the in-flight stages (the last one holds until the action resolves).
  useEffect(() => {
    if (!analysis || analysis.done) return;
    const timers = [700, 2200, 4200].map((d, i) =>
      setTimeout(() => setStageIdx((s) => Math.max(s, i + 1)), d)
    );
    return () => timers.forEach(clearTimeout);
  }, [analysis]);

  // Analysis complete → hold on the payoff for a beat, then advance to Connect.
  useEffect(() => {
    if (!analysis?.done) return;
    const t = setTimeout(
      () => {
        setStep(1);
        setAnalysis(null);
      },
      analysis.scan ? 2800 : 1600
    );
    return () => clearTimeout(t);
  }, [analysis]);

  // Plain onSubmit, NOT <form action>: React wraps form actions in a transition, which
  // defers our state updates until the server action resolves — the tracker would only
  // flash at the end. Setting `analysis` synchronously here paints the collapse at once.
  function submitPersonalize(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setPersonalizeError("");
    const site = String(formData.get("websiteUrl") ?? "").trim();
    const domain = site.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    const startedAt = Date.now();
    if (site) {
      setStageIdx(0);
      setAnalysis({ domain, done: false, scan: null });
    }
    startSaving(async () => {
      const res: PersonalizeState = await savePersonalize({}, formData);
      if (!res.saved) {
        setAnalysis(null);
        setPersonalizeError(res.error ?? "Couldn't save — try again.");
        return;
      }
      if (!site) {
        setStep(1);
        return;
      }
      // Fast (cached) scans still get a readable pass through the stages.
      const hold = Math.max(0, MIN_ANALYSIS_MS - (Date.now() - startedAt));
      if (hold > 0) await new Promise((r) => setTimeout(r, hold));
      const scan = res.scan ?? null;
      if (scan) {
        setScanHeadline(scan.headline);
        setValues((v) => ({
          ...v,
          industry: v.industry || scan.scope_of_industry,
          icp: v.icp || scan.suggested_icp,
          valueProp: v.valueProp || scan.summary,
        }));
      }
      if (res.plays?.length) setPlays(res.plays);
      setStageIdx(4);
      setAnalysis((a) => (a ? { ...a, done: true, scan } : a));
    });
  }

  function connect() {
    setConnectError("");
    startConnect(async () => {
      const res = await createOnboardingConnectLink();
      if (res.url) window.location.href = res.url;
      else setConnectError(res.error ?? "Could not start the connection. Try again.");
    });
  }

  const railCurrent = step + 1; // PIPELINE index of the active step

  return (
    <div className="flex min-h-svh w-full">
      <PipelineRail current={railCurrent} working={Boolean(analysis && !analysis.done)} />

      {/* RIGHT — the input panel */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(44% 34% at 50% 0%, rgba(11,87,171,0.10), transparent 62%)" }}
        />

        {/* Mobile header — the rail collapses to a compact progress strip */}
        <div className="border-b border-[var(--hairline)] bg-white/80 px-6 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <VanteraLogo className="size-5 text-foreground" />
              <span className="text-[16px] font-semibold tracking-[-0.02em]">Vantera</span>
            </Link>
            <span className="text-[12.5px] text-[var(--ink-3)]">
              Step {step + 1} of {STEP_LABELS.length} · {STEP_LABELS[step]}
            </span>
          </div>
          <div className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-[#eef0f3]">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--cyan)]"
              initial={false}
              animate={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[560px]">
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <Glow />
              <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-lift)]">
                <AnimatePresence mode="wait">
                  {/* ── Step 0: Personalize — form, or the live analysis tracker while it runs ── */}
                  {step === 0 && analysis && (
                    <motion.div key="analysis" initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                      <AnalysisTracker analysis={analysis} stageIdx={stageIdx} plays={plays} />
                    </motion.div>
                  )}

                  {step === 0 && !analysis && (
                    <motion.form key="personalize" onSubmit={submitPersonalize} initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                      <div className="px-8 pt-8 pb-6">
                        <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">Personalize your account</h2>
                        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-3)]">
                          A few basics so your agent sounds like you — then we read your site and learn the rest.
                        </p>
                      </div>
                      <div className="space-y-8 px-8 pb-8">
                        <Field label="Company name" hint="This names your workspace.">
                          <Input name="companyName" value={values.companyName} onChange={(e) => setValues({ ...values, companyName: e.target.value })} placeholder="e.g. Acme Inc" autoFocus required className={FIELD} />
                        </Field>
                        <Field label="Your role" hint="How the agent represents you in outreach.">
                          <select
                            name="role"
                            value={values.role}
                            onChange={(e) => setValues({ ...values, role: e.target.value })}
                            required
                            className={cn(FIELD, "appearance-none bg-white")}
                          >
                            <option value="" disabled>
                              Select your role
                            </option>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Website URL" hint="We analyze it live to learn what you sell and who to target.">
                          <Input name="websiteUrl" value={values.websiteUrl} onChange={(e) => setValues({ ...values, websiteUrl: e.target.value })} placeholder="e.g. acme.com" className={FIELD} />
                        </Field>
                        <Field label="Your LinkedIn URL" hint="Optional — helps us tailor your outreach voice.">
                          <Input name="linkedinUrl" value={values.linkedinUrl} onChange={(e) => setValues({ ...values, linkedinUrl: e.target.value })} placeholder="e.g. linkedin.com/in/you" className={FIELD} />
                        </Field>
                        <FormError message={personalizeError} />
                      </div>
                      <div className="flex items-center justify-end border-t border-[var(--hairline)] px-8 py-5">
                        <button type="submit" disabled={savingPersonalize} className={DARK_BTN}>
                          {savingPersonalize ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Saving…
                            </>
                          ) : (
                            <>
                              Continue <ChevronRight className="size-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {/* ── Step 1: Connect LinkedIn — the activation gate, and the moment the
                        product turns on. Framed as the payoff, not a hurdle: value first
                        (the buyer we found), the ban-fear defused right at the button, and
                        only a deliberate, cost-stating opt-out (no casual "Skip"). ── */}
                  {step === 1 && (
                    <motion.div key="connect" initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                      <div className="px-8 pt-8 pb-2">
                        <div className="mb-4 grid size-11 place-items-center rounded-lg bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(11,87,171,0.22)]">
                          <Link2 className="size-5" strokeWidth={2.2} />
                        </div>
                        <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">
                          {init.connected ? "LinkedIn connected" : "Connect your LinkedIn"}
                        </h2>
                        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-3)]">
                          {init.connected
                            ? "You're activated — Vera can now reach buyers from your own LinkedIn, and nothing sends until you approve it."
                            : "This is the step that turns Vera loose — outreach runs from your own LinkedIn, securely, through our partner's hosted login."}
                        </p>
                      </div>
                      <div className="space-y-4 px-8 pt-4 pb-8">
                        {init.connected ? (
                          <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(11,87,171,0.28)] bg-[var(--cyan-tint)] p-4 text-[13.5px] font-medium text-foreground">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--cyan)] text-white">
                              <Check className="size-3.5" strokeWidth={2.6} />
                            </span>
                            LinkedIn connected — you&apos;re ready to go.
                          </div>
                        ) : (
                          <>
                            {/* value-before-friction (Stage 0): show the proven plays BEFORE the ask, so
                                connecting stops being a blind permission grant and becomes "turn on the
                                thing I've already seen work". Honest source labels, never network claims. */}
                            {values.icp && (
                              <div className="rounded-xl bg-[var(--cyan-tint)] px-4 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--cyan-strong)]">
                                  Vera is ready
                                </p>
                                <p className="mt-1 text-[13.5px] leading-snug text-foreground">
                                  Here are the plays queued for{" "}
                                  <span className="font-medium">{values.icp}</span> — connect LinkedIn to turn
                                  them on.
                                </p>
                                {plays.length > 0 && (
                                  <ul className="mt-2.5 space-y-1.5 border-t border-[rgba(11,87,171,0.16)] pt-2.5">
                                    {plays.map((p) => (
                                      <li key={p.slug} className="flex items-baseline justify-between gap-3">
                                        <span className="text-[12.5px] font-medium text-foreground">{p.name}</span>
                                        <span className="shrink-0 text-[10.5px] text-[var(--ink-4)]">
                                          {p.sourceLabel}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                            {/* defuse the category's #1 fear ("will this get my account restricted?") at the button */}
                            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {[
                                "LinkedIn-safe, human-like pacing",
                                "You approve every message",
                                "We never see your password",
                                "Disconnect anytime in Settings",
                              ].map((line) => (
                                <li key={line} className="flex items-start gap-2 text-[12.5px] leading-snug text-[var(--ink-2)]">
                                  <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--cyan-strong)]" strokeWidth={2.4} /> {line}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}

                        {connectError && <FormError message={connectError} />}

                        {init.connected ? (
                          <button type="button" onClick={() => setStep(2)} className={cn(DARK_BTN, "w-full")}>
                            Continue <ChevronRight className="size-4" />
                          </button>
                        ) : (
                          <button type="button" onClick={connect} disabled={connecting} className={cn(DARK_BTN, "w-full")}>
                            {connecting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                            {connecting ? "Opening secure login…" : "Connect LinkedIn"}
                          </button>
                        )}

                        {/* deliberate, cost-stating opt-out — not a peer action, and it never
                            claims skipping is fine. Removed the old one-tap "Skip for now". */}
                        {!init.connected && (
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            className="mx-auto block max-w-xs text-center text-[12px] leading-relaxed text-[var(--ink-4)] underline-offset-2 transition-colors hover:text-[var(--ink-3)] hover:underline"
                          >
                            I&apos;ll connect later — no outreach can send until I do
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-start border-t border-[var(--hairline)] px-8 py-5">
                        <button type="button" onClick={() => setStep(0)} className={GHOST_BTN}>
                          <ChevronLeft className="size-4" /> Back
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 2: Confirmation (derived, editable) ── */}
                  {step === 2 && (
                    <motion.form key="confirm" action={findAction} initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                      <div className="px-8 pt-8 pb-2">
                        <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">Here&apos;s what we got</h2>
                        {scanHeadline ? (
                          <p className="mt-2 text-[15px] font-medium leading-snug text-foreground">{scanHeadline}</p>
                        ) : (
                          <p className="mt-2 text-[14px] text-[var(--ink-3)]">Confirm who to target — tweak anything that&apos;s off.</p>
                        )}
                        {init.connected ? (
                          <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-3)]">
                            <Check className="size-3.5 text-[var(--cyan-strong)]" /> LinkedIn connected
                          </p>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[rgba(200,129,27,0.32)] bg-[rgba(200,129,27,0.08)] px-3 py-2 text-[12.5px] leading-snug text-[var(--ink-2)]">
                            <span className="font-medium text-foreground">LinkedIn isn&apos;t connected.</span>
                            <span>Your agents can source and qualify, but they can&apos;t send outreach until you connect.</span>
                            <button
                              type="button"
                              onClick={() => setStep(1)}
                              className="font-semibold text-[var(--cyan-strong)] underline-offset-2 hover:underline"
                            >
                              Connect now →
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-8 px-8 pt-5 pb-8">
                        <Field
                          label="Your industry"
                          hint={derivedFromSite ? "Pulled from your site — edit if it’s off." : "In a few words, what does your company do?"}
                        >
                          <Input name="industry" value={values.industry} onChange={(e) => setValues({ ...values, industry: e.target.value })} placeholder="e.g. B2B SaaS" required className={FIELD} />
                        </Field>
                        <Field
                          label="How should the agent describe what you do?"
                          hint={derivedFromSite ? "Pulled from your site — edit if it’s off. This is your positioning in conversations." : "One or two sentences: what you do, for whom, and why it matters."}
                        >
                          <Textarea
                            name="valueProp"
                            value={values.valueProp}
                            onChange={(e) => setValues({ ...values, valueProp: e.target.value })}
                            rows={3}
                            placeholder="e.g. We book qualified sales calls for B2B SaaS teams without the SDR overhead."
                            className={FIELD + " h-auto py-3"}
                          />
                        </Field>
                        <Field
                          label="Who to target"
                          hint={derivedFromSite ? "Your agent prospects for this — make it specific." : "Who buys from you? Role + company type works best."}
                        >
                          <Input name="icp" value={values.icp} onChange={(e) => setValues({ ...values, icp: e.target.value })} placeholder="e.g. VP of Sales at mid-market SaaS" required className={FIELD} />
                        </Field>
                        <div className="grid gap-8 sm:grid-cols-2">
                          <Field label="Monthly revenue goal" hint="We track pipeline against this.">
                            <Input name="revenueGoal" value={values.revenueGoal} onChange={(e) => setValues({ ...values, revenueGoal: e.target.value })} placeholder="25,000" inputMode="decimal" required className={FIELD} />
                          </Field>
                          <Field label="Average deal value" hint="Turns each lead into a $ figure.">
                            <Input name="avgDealValue" value={values.avgDealValue} onChange={(e) => setValues({ ...values, avgDealValue: e.target.value })} placeholder="5,000" inputMode="decimal" required className={FIELD} />
                          </Field>
                        </div>
                        {/* L1 meeting layer: the conversion-critical fact. Required with an
                            honest escape hatch — skipping creates a dashboard task, not silence. */}
                        <Field
                          label="Where should interested buyers book you?"
                          hint="Your Calendly, cal.com, or any scheduling link. Vera offers it the moment a prospect shows interest — it's how conversations become meetings."
                        >
                          <Input
                            name="bookingUrl"
                            value={values.bookingUrl}
                            onChange={(e) => setValues({ ...values, bookingUrl: e.target.value })}
                            placeholder="https://cal.com/you/intro"
                            inputMode="url"
                            className={FIELD}
                          />
                          <label className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--ink-3)]">
                            <input type="checkbox" name="noBookingUrl" className="size-3.5" />
                            I don&apos;t have one yet — remind me on the dashboard
                          </label>
                        </Field>
                        <FormError message={findState.error} />
                        <p className="rounded-xl bg-[var(--tint)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
                          This is the last step — it puts Vera to work: your Prospect, Outreach, and Intent
                          agents deploy, starting on proven plays and getting smarter from your results.
                          They start within ~15 minutes, and nothing sends without your approval.
                        </p>
                      </div>
                      <div className="flex items-center justify-between border-t border-[var(--hairline)] px-8 py-5">
                        <button type="button" onClick={() => setStep(1)} className={GHOST_BTN}>
                          <ChevronLeft className="size-4" /> Back
                        </button>
                        <button type="submit" disabled={finding} className={DARK_BTN}>
                          {finding ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                          {finding ? "Vera is going to work…" : "Put Vera to work"}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <p className="mt-6 text-center text-[12px] text-[var(--ink-4)]">
              You can change any of this later in Settings — nothing&apos;s locked in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Left rail — light system to match the input panel, carrying the top-to-bottom pipeline ── */

function PipelineRail({ current, working }: { current: number; working: boolean }) {
  return (
    <aside className="relative hidden w-[400px] shrink-0 flex-col overflow-hidden border-r border-[var(--hairline)] bg-[var(--tint)] px-10 py-10 lg:flex xl:w-[440px]">
      {/* one soft cyan wash up top — same ambience recipe as the input side */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 36% at 22% 0%, rgba(11,87,171,0.10) 0%, transparent 64%), radial-gradient(44% 30% at 96% 100%, rgba(11,87,171,0.05) 0%, transparent 60%)",
        }}
      />

      <Link href="/" className="relative flex items-center gap-2 text-foreground">
        <VanteraLogo className="size-6 text-foreground" />
        <span className="text-[19px] font-semibold tracking-[-0.02em]">Vantera</span>
      </Link>

      <div className="relative mt-16 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-4)]">Getting set up</p>
        <ol className="mt-6">
          {PIPELINE.map((s, i) => {
            const done = i < current;
            const active = i === current;
            const last = i === PIPELINE.length - 1;
            return (
              <li key={s.title} className="relative flex gap-4">
                {/* node + connector */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-[12.5px] transition-all duration-300",
                      done && "bg-[var(--cyan)] text-white shadow-[0_6px_16px_-6px_rgba(11,87,171,0.5)]",
                      active && "bg-white text-[var(--cyan-strong)] ring-2 ring-[var(--cyan)] shadow-[var(--shadow-card)]",
                      !done && !active && "border border-[rgba(12,16,26,0.12)] bg-white text-[var(--ink-4)]"
                    )}
                  >
                    {done ? (
                      <Check className="size-4" strokeWidth={2.6} />
                    ) : active && working ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <span className="font-data font-semibold">{i + 1}</span>
                    )}
                  </span>
                  {!last && (
                    <span className="relative my-1.5 w-px flex-1 overflow-hidden rounded-full bg-[rgba(12,16,26,0.08)]">
                      <motion.span
                        className="absolute inset-x-0 top-0 rounded-full bg-[var(--cyan)]"
                        initial={false}
                        animate={{ height: done ? "100%" : "0%" }}
                        transition={{ duration: 0.5, ease: EASE }}
                      />
                    </span>
                  )}
                </div>
                <div className={cn("min-w-0 pb-8", last && "pb-0")}>
                  <p
                    className={cn(
                      "pt-1 text-[15px] font-medium tracking-[-0.01em] transition-colors duration-300",
                      active ? "text-foreground" : done ? "text-[var(--ink-2)]" : "text-[var(--ink-4)]"
                    )}
                  >
                    {s.title}
                  </p>
                  <p className={cn("mt-1 text-[12.5px] leading-relaxed", active ? "text-[var(--ink-3)]" : "text-[var(--ink-4)]")}>
                    {s.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* the payoff the pipeline points at */}
        <div className="mt-9 rounded-2xl border border-[var(--hairline)] bg-white px-5 py-4 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--cyan-strong)]">Then</p>
          <p className="mt-1.5 text-[14px] font-medium text-foreground">Vera goes to work</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
            Sourcing starts within ~15 minutes on proven plays — you approve everything Vera sends.
          </p>
        </div>
      </div>

      <div className="relative mt-10 space-y-2.5 border-t border-[var(--hairline)] pt-6">
        {[
          "You approve every message before it sends",
          "We never see your LinkedIn password",
          "Change anything later in Settings",
        ].map((line) => (
          <p key={line} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
            <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--cyan-strong)]" /> {line}
          </p>
        ))}
      </div>
    </aside>
  );
}

/* ── The live analysis tracker — top-to-bottom stages while the real scan runs ── */

function AnalysisTracker({
  analysis,
  stageIdx,
  plays,
}: {
  analysis: Analysis;
  stageIdx: number;
  plays: PlayCard[];
}) {
  const stages = analysisStages(analysis.domain);
  return (
    <div>
      <div className="px-8 pt-8 pb-6">
        <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">
          {analysis.done ? "Analysis complete" : `Analyzing ${analysis.domain}`}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-3)]">
          {analysis.done
            ? "Here's what your agents now know about you."
            : "Learning your business so every lead and message starts from what you actually sell."}
        </p>
      </div>

      <ol className="px-8 pb-2" aria-live="polite">
        {stages.map((s, i) => {
          const done = analysis.done || i < stageIdx;
          const active = !analysis.done && i === stageIdx;
          const last = i === stages.length - 1;
          return (
            <li key={s.label} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full transition-all duration-300",
                    done && "bg-[var(--cyan)] text-white",
                    active && "bg-white text-[var(--cyan-strong)] ring-2 ring-[var(--cyan)]",
                    !done && !active && "border border-[rgba(12,16,26,0.12)] bg-white text-transparent"
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={2.6} />
                  ) : active ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-[var(--ink-4)]/40" />
                  )}
                </span>
                {!last && (
                  <span className="relative my-1 w-px flex-1 overflow-hidden rounded-full bg-[var(--hairline)]">
                    <motion.span
                      className="absolute inset-x-0 top-0 rounded-full bg-[var(--cyan)]"
                      initial={false}
                      animate={{ height: done ? "100%" : "0%" }}
                      transition={{ duration: 0.45, ease: EASE }}
                    />
                  </span>
                )}
              </div>
              <div className={cn("min-w-0 pb-6", last && "pb-1")}>
                <p
                  className={cn(
                    "pt-0.5 text-[14.5px] font-medium transition-colors duration-300",
                    done || active ? "text-foreground" : "text-[var(--ink-4)]"
                  )}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--ink-4)]">{s.sub}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Payoff — only ever real scan output; a failed scan exits gracefully instead. */}
      <AnimatePresence>
        {analysis.done && analysis.scan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mx-8 mb-8 rounded-2xl bg-[var(--cyan-tint)] px-5 py-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
              What we learned
            </p>
            <p className="mt-1.5 text-[15px] font-medium leading-snug text-foreground">{analysis.scan.headline}</p>
            <p className="mt-1.5 text-[12.5px] text-[var(--ink-3)]">
              Best-fit buyer: <span className="font-medium text-foreground">{analysis.scan.suggested_icp}</span>
            </p>
            {/* The proven-play payoff (Stage 0): show competence BEFORE any ask — Vera already
                has an opening that works for this buyer, honestly sourced. */}
            {plays[0] && (
              <div className="mt-3 border-t border-[rgba(11,87,171,0.16)] pt-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
                  Your first play
                </p>
                <p className="mt-1 text-[13px] leading-snug text-foreground">
                  <span className="font-medium">{plays[0].name}</span> — {plays[0].description}
                </p>
                <p className="mt-1 text-[11.5px] text-[var(--ink-4)]">{plays[0].sourceLabel}</p>
              </div>
            )}
          </motion.div>
        )}
        {analysis.done && !analysis.scan && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-8 mb-8 rounded-2xl bg-[var(--tint)] px-5 py-4 text-[13px] leading-relaxed text-[var(--ink-3)]"
          >
            We couldn&apos;t finish reading your site just now — your Scout retries automatically, and nothing
            here blocks you.
          </motion.p>
        )}
      </AnimatePresence>

      {!analysis.done && (
        <p className="border-t border-[var(--hairline)] px-8 py-5 text-[12px] text-[var(--ink-4)]">
          Usually takes under half a minute. You&apos;ll confirm everything before anything runs.
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <Label className="text-[13px] font-medium text-[var(--ink-2)]">{label}</Label>
      {children}
      <p className="text-[12px] text-[var(--ink-4)]">{hint}</p>
    </div>
  );
}

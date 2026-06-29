"use client";

import { useActionState, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Loader2, Link2, Sparkles, Search } from "lucide-react";
import {
  savePersonalize,
  createOnboardingConnectLink,
  findFirstLeads,
  type PersonalizeState,
  type FindLeadsState,
} from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { cn } from "@/lib/utils";

export type WizardInit = {
  initialStep: number; // 0 personalize · 1 connect · 2 confirmation
  connected: boolean;
  connectFailed: boolean;
  scan: { headline: string; summary: string } | null;
  values: {
    companyName: string;
    role: string;
    websiteUrl: string;
    linkedinUrl: string;
    industry: string;
    icp: string;
    revenueGoal: string;
    avgDealValue: string;
  };
};

const ROLES = ["Founder / CEO", "Sales", "Marketing", "RevOps", "Agency / Consultant", "Other"];
const STEP_LABELS = ["Personalize", "Connect", "Confirm"];
const TOTAL_SEGMENTS = STEP_LABELS.length + 1; // + endowed "account created"

const FIELD =
  "h-11 w-full rounded-xl border border-[rgba(12,16,26,0.12)] bg-white px-4 text-[15px] text-foreground " +
  "placeholder:text-[var(--ink-4)] transition-colors " +
  "focus-visible:border-[var(--cyan-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(48,207,255,0.2)]";

const contentVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.2 } },
};

function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-5 -z-10 rounded-[2.5rem] blur-2xl"
      style={{ background: "radial-gradient(55% 60% at 50% 0%, rgba(48,207,255,0.18), transparent 70%)" }}
    />
  );
}

const DARK_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#0a0c12] px-6 py-3 text-[15px] font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(48,207,255,0.55)] disabled:opacity-60 disabled:hover:translate-y-0";

export function Wizard({ init }: { init: WizardInit }) {
  const [step, setStep] = useState(init.initialStep);
  const [values, setValues] = useState(init.values);

  const [findState, findAction, finding] = useActionState<FindLeadsState, FormData>(findFirstLeads, {});
  const [connecting, startConnect] = useTransition();
  const [connectError, setConnectError] = useState(init.connectFailed ? "LinkedIn didn't connect — try again." : "");
  // Personalize uses a transition (not useActionState) so we can advance to Connect inside the
  // event callback on success — the scan ran server-side and is ready for Confirmation.
  const [savingPersonalize, startSaving] = useTransition();
  const [personalizeError, setPersonalizeError] = useState("");

  function submitPersonalize(formData: FormData) {
    setPersonalizeError("");
    startSaving(async () => {
      const res: PersonalizeState = await savePersonalize({}, formData);
      if (res.saved) setStep(1);
      else setPersonalizeError(res.error ?? "Couldn't save — try again.");
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

  const segmentsDone = 1 + step;

  return (
    <div className="w-full">
      {/* Progress — endowed "account created" head start + the three steps */}
      <motion.div className="mb-9" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-3 flex justify-between">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className="flex flex-col items-center">
              <span
                className={cn(
                  "size-4 rounded-full transition-all duration-300",
                  index <= step ? "" : "bg-[#e2e5ea]",
                  index === step && "ring-4 ring-[rgba(48,207,255,0.22)]"
                )}
                style={index <= step ? { backgroundColor: "var(--cyan)" } : undefined}
              />
              <span className={cn("mt-2 hidden text-xs sm:block", index === step ? "font-medium text-foreground" : "text-[var(--ink-4)]")}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-[#eef0f3]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: "var(--cyan)", boxShadow: "0 0 8px rgba(48,207,255,0.5)" }}
            initial={false}
            animate={{ width: `${(segmentsDone / TOTAL_SEGMENTS) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-[var(--ink-3)]">
          Account created ✓ — {STEP_LABELS.length - step} step{STEP_LABELS.length - step === 1 ? "" : "s"} to your first leads
        </p>
      </motion.div>

      <motion.div className="relative" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <Glow />
        <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-lift)]">
          <AnimatePresence mode="wait">
            {/* ── Step 0: Personalize ── */}
            {step === 0 && (
              <motion.form key="personalize" action={submitPersonalize} initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                <div className="px-8 pt-8 pb-6">
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">Personalize your account</h2>
                  <p className="mt-1.5 text-[14px] text-[var(--ink-3)]">
                    A few basics so your agent sounds like you — and we&apos;ll read your site to learn the rest.
                  </p>
                </div>
                <div className="space-y-7 px-8 pb-8">
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
                  <Field label="Website URL" hint="We scan it to learn what you sell, so your agent finds the right leads.">
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
                        <Loader2 className="size-4 animate-spin" />
                        {values.websiteUrl.trim() ? "Reading your site…" : "Saving…"}
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

            {/* ── Step 1: Connect LinkedIn ── */}
            {step === 1 && (
              <motion.div key="connect" initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                <div className="px-8 pt-8 pb-2">
                  <div className="mb-4 grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(48,207,255,0.22)]">
                    <Link2 className="size-5" strokeWidth={2.2} />
                  </div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">Connect your LinkedIn</h2>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--ink-3)]">
                    Your agent runs outreach from your own LinkedIn — securely, through our partner&apos;s hosted login.
                    You stay in control: nothing sends until you approve it.
                  </p>
                </div>
                <div className="space-y-4 px-8 pt-4 pb-8">
                  {init.connected ? (
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-4 text-[13.5px] text-foreground">
                      <Check className="size-4 text-[var(--cyan-strong)]" /> LinkedIn connected — you&apos;re ready.
                    </div>
                  ) : null}
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
                  <p className="text-center text-[12px] text-[var(--ink-4)]">
                    We never see your password. You can disconnect any time in Settings.
                  </p>
                </div>
                <div className="flex items-center justify-start border-t border-[var(--hairline)] px-8 py-5">
                  <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-[14px] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground">
                    <ChevronLeft className="size-4" /> Back
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Confirmation (derived, editable) ── */}
            {step === 2 && (
              <motion.form key="confirm" action={findAction} initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                <div className="px-8 pt-8 pb-2">
                  <div className="mb-4 grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(48,207,255,0.22)]">
                    <Sparkles className="size-5" strokeWidth={2.2} />
                  </div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">Here&apos;s what we got</h2>
                  {init.scan?.headline ? (
                    <p className="mt-2 text-[15px] font-medium leading-snug text-foreground">{init.scan.headline}</p>
                  ) : (
                    <p className="mt-1.5 text-[14px] text-[var(--ink-3)]">Confirm who to target — tweak anything that&apos;s off.</p>
                  )}
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-3)]">
                    <Check className="size-3.5 text-[var(--cyan-strong)]" /> LinkedIn connected
                  </p>
                </div>
                <div className="space-y-7 px-8 pt-5 pb-8">
                  <Field label="Your industry" hint="Pulled from your site — edit if it&apos;s off.">
                    <Input name="industry" value={values.industry} onChange={(e) => setValues({ ...values, industry: e.target.value })} placeholder="e.g. B2B SaaS" required className={FIELD} />
                  </Field>
                  <Field label="Who to target" hint="Your agent prospects for this — make it specific.">
                    <Input name="icp" value={values.icp} onChange={(e) => setValues({ ...values, icp: e.target.value })} placeholder="e.g. VP of Sales at mid-market SaaS" required className={FIELD} />
                  </Field>
                  <div className="grid gap-7 sm:grid-cols-2">
                    <Field label="Monthly revenue goal" hint="We track pipeline against this.">
                      <Input name="revenueGoal" value={values.revenueGoal} onChange={(e) => setValues({ ...values, revenueGoal: e.target.value })} placeholder="25,000" inputMode="decimal" required className={FIELD} />
                    </Field>
                    <Field label="Average deal value" hint="Turns each lead into a $ figure.">
                      <Input name="avgDealValue" value={values.avgDealValue} onChange={(e) => setValues({ ...values, avgDealValue: e.target.value })} placeholder="5,000" inputMode="decimal" required className={FIELD} />
                    </Field>
                  </div>
                  <FormError message={findState.error} />
                </div>
                <div className="flex items-center justify-between border-t border-[var(--hairline)] px-8 py-5">
                  <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-[14px] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground">
                    <ChevronLeft className="size-4" /> Back
                  </button>
                  <button type="submit" disabled={finding} className={DARK_BTN}>
                    {finding ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    {finding ? "Setting up…" : "Find my first leads"}
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
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <Label className="text-[13px] font-medium text-[var(--ink-2)]">{label}</Label>
      {children}
      <p className="text-[12px] text-[var(--ink-4)]">{hint}</p>
    </div>
  );
}

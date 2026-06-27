"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { completeOnboarding, goLive, type OnboardingState } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { cn } from "@/lib/utils";

type FieldKey = "companyName" | "websiteUrl" | "industry" | "icp" | "revenueGoal" | "avgDealValue";

type Field = {
  key: FieldKey;
  label: string;
  placeholder: string;
  hint: string;
  required: boolean;
};

const STEPS: { label: string; title: string; description: string; fields: Field[] }[] = [
  {
    label: "Company",
    title: "Tell us about your company",
    description: "Let's start with the basics about your business.",
    fields: [
      {
        key: "companyName",
        label: "Company name",
        placeholder: "e.g. Acme Inc",
        hint: "This names your workspace.",
        required: true,
      },
      {
        key: "websiteUrl",
        label: "Website URL",
        placeholder: "e.g. acme.com",
        hint: "Leave blank if you don't have one. We scan it to learn your offerings so your agent finds the right leads.",
        required: false,
      },
    ],
  },
  {
    label: "Industry",
    title: "What industry are you in?",
    description: "Your agent tailors prospecting to your space.",
    fields: [
      {
        key: "industry",
        label: "Industry",
        placeholder: "e.g. B2B SaaS, logistics, fintech",
        hint: "Your agent tailors prospecting to your space.",
        required: true,
      },
    ],
  },
  {
    label: "Audience",
    title: "Who is your target audience?",
    description: "This becomes your default campaign targeting.",
    fields: [
      {
        key: "icp",
        label: "Target audience",
        placeholder: "e.g. VP of Operations at mid-market logistics companies",
        hint: "This becomes your default campaign targeting.",
        required: true,
      },
    ],
  },
  {
    label: "Goals",
    title: "Set your revenue targets",
    description: "We turn every lead into progress toward this — in dollars, not just counts.",
    fields: [
      {
        key: "revenueGoal",
        label: "Monthly revenue goal",
        placeholder: "e.g. 25,000",
        hint: "Your pipeline and results are tracked against this each month.",
        required: true,
      },
      {
        key: "avgDealValue",
        label: "Average deal value",
        placeholder: "e.g. 5,000",
        hint: "What one new client is worth — this turns every qualified lead into a dollar figure.",
        required: true,
      },
    ],
  },
];

const ALL_FIELDS = STEPS.flatMap((s) => s.fields);
const TOTAL_SEGMENTS = STEPS.length + 1; // 1 endowed segment (account created) + wizard steps

const FIELD =
  "h-11 w-full rounded-xl border border-[rgba(12,16,26,0.12)] bg-white px-4 text-[15px] text-foreground " +
  "placeholder:text-[var(--ink-4)] transition-colors " +
  "focus-visible:border-[var(--cyan-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(48,207,255,0.2)]";

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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

export function Wizard({ defaultCompanyName = "" }: { defaultCompanyName?: string }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    companyName: defaultCompanyName,
    websiteUrl: "",
    industry: "",
    icp: "",
    revenueGoal: "",
    avgDealValue: "",
  });
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const [goLiveState, goLiveAction, goingLive] = useActionState<OnboardingState, FormData>(goLive, {});

  if (state.done) {
    const company = values.companyName.trim();
    const website = values.websiteUrl.trim();
    return (
      <motion.div
        className="relative mx-auto max-w-lg"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Glow />
        <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-white p-8 shadow-[var(--shadow-lift)]">
          <motion.div
            className="mb-4 grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(48,207,255,0.22)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
          >
            <Check className="size-5" strokeWidth={2.2} />
          </motion.div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
            {state.scan ? `Here's what we learned about ${company}` : "You're all set"}
          </h2>

          <div className="mt-5 flex flex-col gap-5">
            {state.scan ? (
              <>
                <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">{state.scan.summary}</p>
                {state.scan.offerings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-foreground">What you offer</p>
                    <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-[var(--ink-3)]">
                      {state.scan.offerings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {state.scan.value_props.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-foreground">The outcomes you promise</p>
                    <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-[var(--ink-3)]">
                      {state.scan.value_props.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[12px] text-[var(--ink-4)]">
                  Saved to your workspace — your Prospect Agent uses this to find leads that fit. You
                  can update your website any time in Settings.
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">
                  Your workspace is ready. We couldn&apos;t read {website || "your website"} just now,
                  so your Prospect Agent will scan it on its first run to learn your offerings —
                  nothing for you to do.
                </p>
                <p className="text-[12px] text-[var(--ink-4)]">
                  You can update your website any time in Settings.
                </p>
              </>
            )}

            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-4 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
              Your agent works quality over volume — fewer, better-fit messages, not a blast. A handful
              of strong replies beats a flood of ignored ones, and Analytics shows your rates against
              what&apos;s healthy.
            </div>

            <form action={goLiveAction} className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={goingLive}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0a0c12] px-6 py-3 text-[15px] font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(48,207,255,0.55)] disabled:opacity-60"
              >
                {goingLive ? "Going live…" : "Go live"}
              </button>
              <FormError message={goLiveState.error} />
              <p className="text-center text-[12px] text-[var(--ink-4)]">
                We&apos;ll set up your agents and start sourcing — nothing sends until you approve.
              </p>
            </form>
          </div>
        </div>
      </motion.div>
    );
  }

  const segmentsDone = 1 + step;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const remaining = STEPS.length - step;
  const currentKeys = current.fields.map((f) => f.key);
  const stepComplete = current.fields.every((f) => !f.required || values[f.key].trim().length > 0);
  const willScan = values.websiteUrl.trim().length > 0;

  return (
    <div className="w-full">
      {/* Progress — dots + cyan bar, carrying the endowed "account created" head start */}
      <motion.div
        className="mb-9"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-3 flex justify-between">
          {STEPS.map((s, index) => (
            <div key={s.label} className="flex flex-col items-center">
              <button
                type="button"
                aria-label={`Go to ${s.label}`}
                onClick={() => {
                  if (index <= step) setStep(index);
                }}
                className={cn(
                  "size-4 rounded-full transition-all duration-300",
                  index <= step ? "cursor-pointer" : "cursor-default bg-[#e2e5ea]",
                  index === step && "ring-4 ring-[rgba(48,207,255,0.22)]",
                )}
                style={index <= step ? { backgroundColor: "var(--cyan)" } : undefined}
              />
              <span
                className={cn(
                  "mt-2 hidden text-xs sm:block",
                  index === step ? "font-medium text-foreground" : "text-[var(--ink-4)]",
                )}
              >
                {s.label}
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
          Account created ✓ — {remaining} step{remaining === 1 ? "" : "s"} to your dashboard
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <Glow />
        <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-lift)]">
          <form
            action={action}
            onSubmit={(e) => {
              if (!isLast) {
                e.preventDefault();
                if (stepComplete) setStep(step + 1);
              }
            }}
          >
            {/* earlier answers ride along as hidden fields; visible inputs own the current step */}
            {ALL_FIELDS.filter(({ key }) => !currentKeys.includes(key)).map(({ key }) => (
              <input key={key} type="hidden" name={key} value={values[key]} />
            ))}

            <AnimatePresence mode="wait">
              <motion.div key={step} initial="hidden" animate="visible" exit="exit" variants={contentVariants}>
                <div className="px-8 pt-8 pb-6">
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">{current.title}</h2>
                  <p className="mt-1.5 text-[14px] text-[var(--ink-3)]">{current.description}</p>
                </div>
                <div className="space-y-7 px-8 pb-8">
                  {current.fields.map((field, i) => (
                    <motion.div key={field.key} variants={fadeInUp} className="space-y-2.5">
                      <Label htmlFor={field.key} className="text-[13px] font-medium text-[var(--ink-2)]">
                        {field.label}
                      </Label>
                      <Input
                        id={field.key}
                        name={field.key}
                        value={values[field.key]}
                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        inputMode={field.key === "revenueGoal" || field.key === "avgDealValue" ? "decimal" : "text"}
                        autoFocus={i === 0}
                        required={field.required}
                        className={FIELD}
                      />
                      <p className="text-[12px] text-[var(--ink-4)]">{field.hint}</p>
                    </motion.div>
                  ))}
                  <FormError message={state.error} />
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between border-t border-[var(--hairline)] px-8 py-5">
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={step === 0 || pending}
                className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-[14px] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-[var(--ink-3)]"
              >
                <ChevronLeft className="size-4" /> Back
              </button>
              <button
                type="submit"
                disabled={(!isLast && !stepComplete) || pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0c12] px-6 py-2.5 text-[14px] font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(48,207,255,0.55)] disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {willScan ? "Scanning your website…" : "Finishing…"}
                  </>
                ) : isLast ? (
                  <>
                    Finish setup <Check className="size-4" />
                  </>
                ) : (
                  <>
                    Continue <ChevronRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>

        <p className="mt-6 text-center text-[13px] text-[var(--ink-4)]">
          Step {step + 1} of {STEPS.length}: {current.title}
        </p>
        <p className="mt-2 text-center text-[12px] text-[var(--ink-4)]">
          You can change any of this later in Settings — nothing&apos;s locked in.
        </p>
    </div>
  );
}

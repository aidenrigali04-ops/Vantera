"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { AnimatedPanelBorder } from "@/components/ui/animated-border";
import { AnimatedProgress } from "@/components/ui/animated-progress";
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

// Clean monochrome sweep (white → soft grey) — matches the white-glow system
const BRAND_GRADIENT =
  "linear-gradient(90deg, #ffffff 0%, #d4d4d4 100%)";

// Traveling white-glow beam (leading transparent = comet tail)
const PARTICLE_BEAM =
  "linear-gradient(90deg,transparent,#ffffff,transparent)";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const contentVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -50, transition: { duration: 0.2 } },
};

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
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {}
  );

  if (state.done) {
    const company = values.companyName.trim();
    const website = values.websiteUrl.trim();
    return (
      <motion.div
        className="relative rounded-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border shadow-md rounded-3xl overflow-hidden [--card-spacing:--spacing(8)]">
          <CardHeader className="pb-6">
            <motion.div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
            >
              <Check className="h-5 w-5" />
            </motion.div>
            <CardTitle className="text-lg font-bold tracking-tight">
              {state.scan ? `Here's what we learned about ${company}` : "You're all set"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-2">
            {state.scan ? (
              <>
                <p className="text-sm">{state.scan.summary}</p>
                {state.scan.offerings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">What you offer</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {state.scan.offerings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {state.scan.value_props.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">The outcomes you promise</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {state.scan.value_props.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Saved to your workspace — your Prospect Agent uses this to find leads that fit.
                  You can update your website any time in Settings.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Your workspace is ready. We couldn&apos;t read{" "}
                  {website || "your website"} just now, so your Prospect Agent will scan it on its
                  first run to learn your offerings — nothing for you to do.
                </p>
                <p className="text-xs text-muted-foreground">
                  You can update your website any time in Settings.
                </p>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              One thing to expect: your agent works quality over volume — fewer, better-fit
              messages, not a blast. A handful of strong replies beats a flood of ignored ones, and
              Analytics shows your rates against what&apos;s healthy.
            </p>
            <Button asChild className="rounded-2xl">
              <a href="/dashboard">Go to dashboard</a>
            </Button>
          </CardContent>
        </Card>
        <AnimatedPanelBorder gradient={PARTICLE_BEAM} />
      </motion.div>
    );
  }

  const segmentsDone = 1 + step;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const remaining = STEPS.length - step;
  const currentKeys = current.fields.map((f) => f.key);
  const stepComplete = current.fields.every(
    (f) => !f.required || values[f.key].trim().length > 0
  );
  const willScan = values.websiteUrl.trim().length > 0;

  return (
    <div className="w-full">
      {/* Progress indicator — dots + labels carry the endowed "account created" head start */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between mb-3">
          {STEPS.map((s, index) => (
            <motion.div
              key={s.label}
              className="flex flex-col items-center"
              whileHover={{ scale: 1.1 }}
            >
              <motion.div
                className={cn(
                  "w-4 h-4 rounded-full cursor-pointer transition-colors duration-300",
                  index === step && "ring-4 ring-white/25",
                  index > step && "bg-muted"
                )}
                style={
                  index <= step ? { backgroundImage: BRAND_GRADIENT } : undefined
                }
                onClick={() => {
                  // only allow going back to already-completed steps
                  if (index <= step) setStep(index);
                }}
                whileTap={{ scale: 0.95 }}
              />
              <motion.span
                className={cn(
                  "text-xs mt-2 hidden sm:block",
                  index === step ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {s.label}
              </motion.span>
            </motion.div>
          ))}
        </div>
        <AnimatedProgress
          value={(segmentsDone / TOTAL_SEGMENTS) * 100}
          className="mt-3"
          label={`Step ${segmentsDone} of ${TOTAL_SEGMENTS}`}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Account created ✓ — {remaining} step{remaining === 1 ? "" : "s"} to your dashboard
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div
        className="relative rounded-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="border shadow-md rounded-3xl overflow-hidden [--card-spacing:--spacing(8)]">
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
              <motion.div
                key={step}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={contentVariants}
              >
                <CardHeader className="gap-2.5 pb-6">
                  <CardTitle className="text-lg font-bold tracking-tight">
                    {current.title}
                  </CardTitle>
                  <CardDescription className="font-normal">
                    {current.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-9 pt-4 pb-8">
                  {current.fields.map((field, i) => (
                    <motion.div key={field.key} variants={fadeInUp} className="space-y-3.5">
                      <Label htmlFor={field.key} className="font-semibold">
                        {field.label}
                      </Label>
                      <Input
                        id={field.key}
                        name={field.key}
                        value={values[field.key]}
                        onChange={(e) =>
                          setValues({ ...values, [field.key]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        inputMode={field.key === "revenueGoal" || field.key === "avgDealValue" ? "decimal" : "text"}
                        autoFocus={i === 0}
                        required={field.required}
                        className="h-11 px-4 text-base transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <p className="pt-0.5 text-xs text-muted-foreground">{field.hint}</p>
                    </motion.div>
                  ))}
                  <FormError message={state.error} />
                </CardContent>
              </motion.div>
            </AnimatePresence>

            <CardFooter className="flex justify-between pt-8 pb-6">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                  disabled={step === 0 || pending}
                  className="flex items-center gap-1 transition-all duration-300 rounded-2xl"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="submit"
                  disabled={(!isLast && !stepComplete) || pending}
                  className="flex items-center gap-1 transition-all duration-300 rounded-2xl"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {willScan ? "Scanning your website…" : "Finishing…"}
                    </>
                  ) : isLast ? (
                    <>
                      Finish setup <Check className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            </CardFooter>
          </form>
        </Card>
        <AnimatedPanelBorder gradient={PARTICLE_BEAM} />
      </motion.div>

      {/* Step indicator */}
      <motion.div
        className="mt-6 text-center text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        Step {step + 1} of {STEPS.length}: {current.title}
      </motion.div>
    </div>
  );
}

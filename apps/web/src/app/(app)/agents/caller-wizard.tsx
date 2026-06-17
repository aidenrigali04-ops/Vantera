"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/form-error";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { deployCallerAgent, updateCallerAgent, type AgentActionState } from "./actions";

const STEPS = ["Name", "Targeting", "Goal", "Voice", "Content", "Window", "Deploy"] as const;

const VOICE_OPTIONS = [
  { voiceId: "voice-natural-en-1", label: "Alex — conversational, warm" },
  { voiceId: "voice-natural-en-2", label: "Jordan — clear, professional" },
  { voiceId: "voice-natural-en-3", label: "Morgan — energetic, friendly" },
  { voiceId: "voice-natural-en-4", label: "Riley — calm, authoritative" },
];

const LANGUAGE_OPTIONS = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-US", label: "Spanish (US)" },
  { code: "fr-FR", label: "French" },
];

const DAYS_OF_WEEK = [
  { key: "Mon", label: "Mon" },
  { key: "Tue", label: "Tue" },
  { key: "Wed", label: "Wed" },
  { key: "Thu", label: "Thu" },
  { key: "Fri", label: "Fri" },
  { key: "Sat", label: "Sat" },
  { key: "Sun", label: "Sun" },
];

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const CTA_EXAMPLES = [
  "book a 15-minute intro call",
  "get a free product demo",
  "connect with our team this week",
] as const;

export type CallerEditValues = {
  name: string;
  cta: string;
  bookingLink: string;
  voiceId: string;
  personaName: string;
  language: string;
  brandVoice: string;
  guardrails: string;
  recordingConsentMode: "one_party" | "two_party";
  callingWindowDays: string[];
  startLocal: string;
  endLocal: string;
  maxAttempts: number;
  links: string;
};

export function CallerWizard({
  scoutName,
  icpNames,
  edit,
}: {
  scoutName: string;
  icpNames: string[];
  edit?: CallerEditValues;
}) {
  const isEdit = Boolean(edit);
  const [step, setStep] = useState(0);

  // Step 0: Name
  const [name, setName] = useState(edit?.name ?? "");

  // Step 2: Goal & Booking
  const [cta, setCta] = useState(edit?.cta ?? "");
  const [bookingLink, setBookingLink] = useState(edit?.bookingLink ?? "");

  // Step 3: Voice & Identity
  const [voiceId, setVoiceId] = useState(edit?.voiceId ?? VOICE_OPTIONS[0]!.voiceId);
  const [personaName, setPersonaName] = useState(edit?.personaName ?? "");
  const [language, setLanguage] = useState(edit?.language ?? "en-US");
  const [brandVoice, setBrandVoice] = useState(edit?.brandVoice ?? "");
  const [guardrails, setGuardrails] = useState(edit?.guardrails ?? "");

  // Step 4: Content (links)
  const [links, setLinks] = useState(edit?.links ?? "");
  const [fileCount, setFileCount] = useState(0);

  // Step 5: Calling Window
  const [callingDays, setCallingDays] = useState<string[]>(
    edit?.callingWindowDays ?? DEFAULT_DAYS
  );
  const [startLocal, setStartLocal] = useState(edit?.startLocal ?? "09:00");
  const [endLocal, setEndLocal] = useState(edit?.endLocal ?? "17:00");
  const [maxAttempts, setMaxAttempts] = useState(edit?.maxAttempts ?? 3);
  const [recordingConsentMode, setRecordingConsentMode] = useState<"one_party" | "two_party">(
    edit?.recordingConsentMode ?? "one_party"
  );

  const [state, action, pending] = useActionState<AgentActionState, FormData>(
    isEdit ? updateCallerAgent : deployCallerAgent,
    {}
  );

  const toggleDay = (day: string) => {
    setCallingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const canNext =
    (step === 0 && name.trim().length > 0) ||
    step === 1 ||
    (step === 2 && cta.trim().length >= 3 && bookingLink.trim().length > 0) ||
    (step === 3 && voiceId.trim().length > 0 && personaName.trim().length > 0) ||
    step === 4 ||
    (step === 5 && callingDays.length > 0 && startLocal < endLocal) ||
    step === 6;

  return (
    <WizardShell
      stepLabels={[...STEPS]}
      step={step}
      endowed={1}
      endowedNote={`Targeting inherited from ${scoutName} ✓`}
      title={
        [
          "Name your agent",
          "Who it calls",
          "What's the ask?",
          "Voice & identity",
          "Give it material",
          "Calling window",
          isEdit
            ? `Save changes to ${name.trim() || "your agent"}`
            : `Deploy ${name.trim() || "your agent"}`,
        ][step]!
      }
      hint={
        [
          "Your AI calling teammate — it calls every qualified lead, one conversation at a time.",
          "Set by your Prospect Agent — every call targets these people.",
          "What should every conversation invite the prospect to do?",
          "Choose a voice and the name your agent will introduce itself as.",
          isEdit
            ? "Add more material — anything you already uploaded stays."
            : "Optional — the more context it has, the sharper every conversation.",
          "When and how many times should your agent call each lead?",
          isEdit ? "Review your changes, then save the new config." : "Review everything, then deploy.",
        ][step]
      }
    >
      <form action={action} className="flex flex-col gap-5">
        {/* hidden fields carry all collected values to the final submit */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="cta" value={cta} />
        <input type="hidden" name="bookingLink" value={bookingLink} />
        <input type="hidden" name="voiceId" value={voiceId} />
        <input type="hidden" name="personaName" value={personaName} />
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="brandVoice" value={brandVoice} />
        <input type="hidden" name="guardrails" value={guardrails} />
        <input type="hidden" name="recordingConsentMode" value={recordingConsentMode} />
        <input type="hidden" name="callingWindowDays" value={JSON.stringify(callingDays)} />
        <input type="hidden" name="startLocal" value={startLocal} />
        <input type="hidden" name="endLocal" value={endLocal} />
        <input type="hidden" name="maxAttempts" value={String(maxAttempts)} />
        <input type="hidden" name="links" value={links} />

        {step === 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="caller-name">Agent name</Label>
            <Input
              id="caller-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aria, Volt, Max"
              maxLength={60}
              autoFocus
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-wrap gap-2">
            {icpNames.map((icp) => (
              <Badge key={icp} variant="secondary" className="py-1 px-3 text-sm">
                {icp}
              </Badge>
            ))}
            <p className="w-full pt-2 text-xs text-muted-foreground">
              To change targeting, edit {scoutName} — both agents stay in sync.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-cta">Call to action</Label>
              <Textarea
                id="caller-cta"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="e.g. book a 15-minute intro call"
                maxLength={200}
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CTA_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setCta(example)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-booking-link">Booking link</Label>
              <Input
                id="caller-booking-link"
                value={bookingLink}
                onChange={(e) => setBookingLink(e.target.value)}
                placeholder="https://cal.com/yourname/intro"
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                Where qualified prospects can book time — shared during each call.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-persona-name">Caller name</Label>
              <Input
                id="caller-persona-name"
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                placeholder="e.g. Aria, Sam, Jordan"
                maxLength={40}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                What your agent introduces itself as on every call.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-voice">Voice</Label>
              <select
                id="caller-voice"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.voiceId} value={v.voiceId}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-language">Language</Label>
              <select
                id="caller-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-brand-voice">Brand voice <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="caller-brand-voice"
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="e.g. Warm and consultative, like a senior peer — never pushy or salesy. Plain language, a little understated."
                maxLength={600}
              />
              <p className="text-xs text-muted-foreground">
                How your agent should sound. Shapes tone only — it never overrides honesty or compliance.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-guardrails">Guardrails <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="caller-guardrails"
                value={guardrails}
                onChange={(e) => setGuardrails(e.target.value)}
                placeholder="e.g. Never name competitors. Don't discuss pricing on the call. Avoid jargon and hype."
                maxLength={600}
              />
              <p className="text-xs text-muted-foreground">
                Topics, claims, or words your agent must always avoid.
              </p>
            </div>
          </div>
        )}

        {/* stays mounted across steps so chosen files survive to the final submit */}
        <div className={step === 4 ? "flex flex-col gap-4" : "hidden"}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="caller-links">Links (one per line)</Label>
            <Textarea
              id="caller-links"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={"https://yoursite.com/case-study\nhttps://yoursite.com/demo"}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="caller-files">Files or images (up to 5, 5 MB each)</Label>
            <Input
              id="caller-files"
              name="files"
              type="file"
              multiple
              onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Context helps your agent respond to common objections and product questions.
          </p>
        </div>

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Calling days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(({ key, label }) => {
                  const on = callingDays.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(key)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        on
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {callingDays.length === 0 && (
                <p className="text-xs text-destructive">Pick at least one calling day.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="caller-start">Earliest call time</Label>
                <Input
                  id="caller-start"
                  type="time"
                  value={startLocal}
                  min="08:00"
                  max="20:59"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v < "08:00") setStartLocal("08:00");
                    else if (v > "21:00") setStartLocal("21:00");
                    else setStartLocal(v);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="caller-end">Latest call time</Label>
                <Input
                  id="caller-end"
                  type="time"
                  value={endLocal}
                  min="08:01"
                  max="21:00"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v < "08:00") setEndLocal("08:00");
                    else if (v > "21:00") setEndLocal("21:00");
                    else setEndLocal(v);
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Times are in the prospect&apos;s local timezone. Calls only place between 8 AM and 9 PM to
              respect calling regulations.
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="caller-max-attempts">Max call attempts per lead</Label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={maxAttempts === n}
                    onClick={() => setMaxAttempts(n)}
                    className={`flex size-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                      maxAttempts === n
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Your agent stops calling after this many unanswered attempts.
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1 text-sm font-medium">Recording consent</legend>
              {(
                [
                  {
                    value: "one_party" as const,
                    title: "One-party consent",
                    note: "Only your side needs to know the call is recorded. Common in most US states.",
                  },
                  {
                    value: "two_party" as const,
                    title: "Two-party consent",
                    note: "Your agent will inform prospects the call may be recorded. Required in some states.",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={recordingConsentMode === opt.value}
                  onClick={() => setRecordingConsentMode(opt.value)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    recordingConsentMode === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <span className="font-medium">{opt.title}</span>
                  <span className="text-xs text-muted-foreground">{opt.note}</span>
                </button>
              ))}
            </fieldset>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Agent</dt>
              <dd className="font-medium">{name}</dd>
              <dt className="text-muted-foreground">Calls</dt>
              <dd>{icpNames.join(" · ")}</dd>
              <dt className="text-muted-foreground">CTA</dt>
              <dd>{cta}</dd>
              <dt className="text-muted-foreground">Booking link</dt>
              <dd className="truncate">{bookingLink}</dd>
              <dt className="text-muted-foreground">Caller identity</dt>
              <dd>
                {personaName || "—"} ·{" "}
                {VOICE_OPTIONS.find((v) => v.voiceId === voiceId)?.label ?? voiceId}
              </dd>
              <dt className="text-muted-foreground">Language</dt>
              <dd>{LANGUAGE_OPTIONS.find((l) => l.code === language)?.label ?? language}</dd>
              {brandVoice.trim() && (
                <>
                  <dt className="text-muted-foreground">Brand voice</dt>
                  <dd className="line-clamp-2">{brandVoice.trim()}</dd>
                </>
              )}
              {guardrails.trim() && (
                <>
                  <dt className="text-muted-foreground">Guardrails</dt>
                  <dd className="line-clamp-2">{guardrails.trim()}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Calling days</dt>
              <dd>{callingDays.length > 0 ? callingDays.join(" · ") : "—"}</dd>
              <dt className="text-muted-foreground">Window</dt>
              <dd>
                {startLocal} – {endLocal}
              </dd>
              <dt className="text-muted-foreground">Max attempts</dt>
              <dd>{maxAttempts}</dd>
              <dt className="text-muted-foreground">Recording consent</dt>
              <dd>
                {recordingConsentMode === "two_party" ? "Two-party" : "One-party"}
              </dd>
              <dt className="text-muted-foreground">Content</dt>
              <dd>
                {(() => {
                  const linkCount = links.split("\n").filter((l) => l.trim()).length;
                  const parts = [
                    linkCount > 0 && `${linkCount} link${linkCount === 1 ? "" : "s"}`,
                    fileCount > 0 && `${fileCount} file${fileCount === 1 ? "" : "s"}`,
                  ].filter(Boolean);
                  return parts.length > 0 ? parts.join(" · ") : "none — add anytime";
                })()}
              </dd>
            </dl>

            <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              {name.trim() || "Your agent"} starts briefing as qualified leads arrive. Every call
              waits in review before it goes out — nothing dials without you. Calls only place
              within your {callingDays.join(", ")} window between {startLocal} and {endLocal}.
            </p>
          </div>
        )}

        <FormError message={state.error} />

        <div className="flex justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || pending}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}>
              {step === STEPS.length - 2 ? "Finish" : "Next"}
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {isEdit
                ? pending
                  ? "Saving…"
                  : "Save changes"
                : pending
                  ? "Deploying…"
                  : `Deploy ${name.trim() || "agent"}`}
            </Button>
          )}
        </div>
      </form>
    </WizardShell>
  );
}

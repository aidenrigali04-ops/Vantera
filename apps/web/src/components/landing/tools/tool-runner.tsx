"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Wand2,
} from "lucide-react";
import type { ToolField, ToolOutput } from "@/lib/tools/registry";
import { ToolResults } from "./results";
import { cn } from "@/lib/utils";

export interface ToolRunnerProps {
  slug: string;
  cta: string;
  output: ToolOutput;
  outputHeading: string;
  fields: ToolField[];
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FIELD_CLS =
  "w-full rounded-xl border border-[var(--input)] bg-white text-[15px] text-foreground outline-none transition-all placeholder:text-[var(--ink-4)] focus:border-[var(--fb)] focus:shadow-[0_0_0_3px_rgba(24,119,242,0.14)]";

function initialValues(fields: ToolField[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) {
    v[f.name] = f.type === "select" && f.options?.length ? f.options[0].value : "";
  }
  return v;
}

/* ── Blue traveling beam — the signature panel border, tuned to show on white ── */
function ConsoleBeam() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute -inset-px rounded-[inherit] border-2 border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
      <motion.div
        className="absolute aspect-square"
        animate={{ offsetDistance: ["0%", "100%"] }}
        style={{
          width: 90,
          offsetPath: "rect(0 auto auto 0 round 24px)",
          backgroundImage: "linear-gradient(90deg,transparent,#1877f2,transparent)",
          boxShadow: "0 0 12px 3px rgba(24,119,242,0.45)",
        }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 6, ease: "linear" }}
      />
    </div>
  );
}

/* ── Loading skeleton shown while the model generates ─────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-[var(--hairline)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between">
            <div className="h-5 w-20 animate-pulse rounded-full bg-[#eef2f7]" />
            <div className="h-6 w-14 animate-pulse rounded-full bg-[#f4f6f9]" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3.5 animate-pulse rounded bg-[#eef2f7]" style={{ width: "94%" }} />
            <div className="h-3.5 animate-pulse rounded bg-[#eef2f7]" style={{ width: "78%" }} />
            <div className="h-3.5 animate-pulse rounded bg-[#f4f6f9]" style={{ width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToolRunner({ slug, cta, output, outputHeading, fields }: ToolRunnerProps) {
  const reduce = useReducedMotion();
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tools/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputs: values }),
      });
      if (res.status === 429) {
        setError("You've hit the free limit for now. Take a short break and try again — or start free to run outreach at scale.");
        return;
      }
      const data = (await res.json()) as { ok: boolean; result?: unknown; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data.result);
    } catch {
      setError("Couldn't reach the generator. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run();
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Input console (beam + card) ────────────────────────────────────── */}
      <div className="relative rounded-3xl">
        <ConsoleBeam />
        <form
          onSubmit={onSubmit}
          className="relative overflow-hidden rounded-3xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-lift)]"
        >
          {/* header strip */}
          <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-gradient-to-b from-[var(--tint)] to-white px-6 py-3.5 sm:px-8">
            <span className="inline-flex items-center gap-2.5 text-[13.5px] font-semibold text-foreground">
              <span className="grid size-7 place-items-center rounded-lg bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                <Wand2 className="size-4" />
              </span>
              Your details
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-3)] shadow-[var(--shadow-sm)]">
              <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(24,119,242,0.8)]" />
              AI-powered
            </span>
          </div>

          {/* fields */}
          <div className="space-y-5 px-6 py-7 sm:px-8">
            {fields.map((f) => (
              <div key={f.name} className="space-y-2">
                <label htmlFor={f.name} className="block text-[13.5px] font-semibold text-foreground">
                  {f.label}
                  {f.required && <span className="ml-1 text-[var(--cyan-strong)]">*</span>}
                </label>

                {f.type === "textarea" ? (
                  <div className="relative">
                    <textarea
                      id={f.name}
                      value={values[f.name]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      placeholder={f.placeholder}
                      maxLength={f.maxLength}
                      rows={f.rows ?? 3}
                      className={cn(FIELD_CLS, "resize-y px-4 py-3 leading-relaxed")}
                    />
                    {values[f.name].length > 0 && (
                      <span className="pointer-events-none absolute bottom-2.5 right-3 font-mono text-[10.5px] tabular-nums text-[var(--ink-4)]">
                        {values[f.name].length}/{f.maxLength}
                      </span>
                    )}
                  </div>
                ) : f.type === "select" ? (
                  <div className="relative">
                    <select
                      id={f.name}
                      value={values[f.name]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className={cn(FIELD_CLS, "h-12 appearance-none px-4 pr-10")}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-4)]" />
                  </div>
                ) : (
                  <input
                    id={f.name}
                    type="text"
                    value={values[f.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    placeholder={f.placeholder}
                    maxLength={f.maxLength}
                    className={cn(FIELD_CLS, "h-12 px-4")}
                  />
                )}

                {f.hint && <p className="text-[12.5px] leading-relaxed text-[var(--ink-4)]">{f.hint}</p>}
              </div>
            ))}
          </div>

          {/* action bar */}
          <div className="flex flex-col items-center gap-2.5 border-t border-[var(--hairline)] bg-[var(--tint)] px-6 py-5 sm:px-8">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(24,119,242,0.6)] transition-all [background:linear-gradient(180deg,#2a82f7_0%,#1877f2_56%,#166fe5_100%)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-10px_rgba(24,119,242,0.72)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating&hellip;
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> {cta}
                </>
              )}
            </button>
            <p className="text-[12px] text-[var(--ink-4)]">Free · no signup · instant</p>
          </div>
        </form>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[#f3c9c9] bg-[#fdf2f2] p-4 text-[14px] leading-relaxed text-[#a3383c]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Output ─────────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading && !result && (
          <motion.div
            key="loading"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-10"
          >
            <div className="mb-5 flex items-center gap-2 text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">
              <Sparkles className="size-4 animate-pulse text-[var(--cyan-strong)]" />
              Writing your options&hellip;
            </div>
            <LoadingSkeleton />
          </motion.div>
        )}

        {result != null && !loading && (
          <motion.div
            key="result"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-10"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">{outputHeading}</h2>
              <button
                type="button"
                onClick={() => void run()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--ink-2)] transition-all hover:border-[var(--cyan-line)] hover:text-[var(--cyan-strong)]"
              >
                <RefreshCw className="size-3.5" /> Regenerate
              </button>
            </div>

            <ToolResults output={output} result={result} />

            {/* conversion nudge under results */}
            <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--cyan-line)] bg-[var(--cyan-tint)] p-6 text-center sm:p-8">
              <p className="text-[16px] font-semibold text-foreground sm:text-[17px]">
                Now imagine this written for every prospect — automatically.
              </p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[var(--ink-3)]">
                Vantera&rsquo;s SDR agents find in-market buyers on LinkedIn and draft a message like this for each
                one. You approve every send.
              </p>
              <Link
                href="/signup"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full px-6 py-3 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(24,119,242,0.6)] transition-all [background:linear-gradient(180deg,#2a82f7_0%,#1877f2_56%,#166fe5_100%)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-10px_rgba(24,119,242,0.72)]"
              >
                Start free
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

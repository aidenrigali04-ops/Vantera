"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/form-error";
import { CtaArrow, FieldLabel, INPUT, SubmitButton } from "@/app/onboarding/onboarding-ui";
import { BUYERS_CAPS, BUYERS_SIZE_BUCKETS, type BuyersFormValues } from "@/lib/validation/buyers";

/**
 * The buyer-profile editor — one component, two placements (onboarding "Your buyers" and the
 * Playbook targeting page). Renders inside the caller's <form> and emits the plain repeated
 * fields `parseBuyersForm` reads (`titles[]`, …, `excludeAgencies`, `competitors`, `guidance`).
 * No network: regenerating is the caller's job (`onRegenerate`).
 */

export type IcpEditorValue = BuyersFormValues;

type ChipKey = "titles" | "industries" | "geos" | "signals";

const CHIP_GROUPS: { key: ChipKey; label: string; placeholder: string }[] = [
  { key: "titles", label: "Job titles", placeholder: "Add a job title" },
  { key: "industries", label: "Industries", placeholder: "Add an industry" },
  { key: "geos", label: "Locations", placeholder: "Add a country or region" },
  { key: "signals", label: "Signals", placeholder: "Add a buying signal" },
];

const LISTS: { name: "customers" | "companies" | "keywords"; label: string; hint: string }[] = [
  { name: "customers", label: "Existing customers", hint: "One company or website per line." },
  { name: "companies", label: "Other companies to skip", hint: "One company per line." },
  { name: "keywords", label: "Keywords to skip", hint: "Matched in titles, companies, and industries. One per line or comma-separated." },
];

const GROUP_HEADER = "text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--ink-4)]";
const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(12,16,26,0.1)] bg-white px-3 text-[0.85rem] text-foreground";
const TEXTAREA = cn(INPUT, "h-auto min-h-20 py-2.5 leading-relaxed");
const HINT = "mt-2 text-[0.8rem] leading-relaxed text-[var(--ink-3)]";

export function IcpEditor({
  value,
  onRegenerate,
  regenerating = false,
  mode,
  error,
}: {
  value: IcpEditorValue;
  onRegenerate?: () => void;
  regenerating?: boolean;
  mode: "onboarding" | "settings";
  /** The last submit's error, shown above the submit button. */
  error?: string;
}) {
  const [name, setName] = useState(value.name);
  const [chips, setChips] = useState<Record<ChipKey, string[]>>({
    titles: value.criteria.titles,
    industries: value.criteria.industries,
    geos: value.criteria.geos,
    signals: value.criteria.signals,
  });
  const [sizes, setSizes] = useState<string[]>(value.criteria.companySizes);
  const [excludeAgencies, setExcludeAgencies] = useState(value.targeting.excludeAgencies);
  const [excludeFreelancers, setExcludeFreelancers] = useState(value.targeting.excludeFreelancers);

  const addChip = (key: ChipKey, raw: string) => {
    const v = raw.trim().replace(/\s+/g, " ").slice(0, BUYERS_CAPS.entry);
    if (!v) return;
    setChips((prev) => {
      const list = prev[key];
      if (list.length >= BUYERS_CAPS[key] || list.some((c) => c.toLowerCase() === v.toLowerCase())) return prev;
      return { ...prev, [key]: [...list, v] };
    });
  };
  const removeChip = (key: ChipKey, chip: string) =>
    setChips((prev) => ({ ...prev, [key]: prev[key].filter((c) => c !== chip) }));
  const toggleSize = (size: string) =>
    setSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));

  return (
    <div className="flex flex-col gap-7">
      <div>
        <FieldLabel htmlFor="icp-name">Profile name</FieldLabel>
        <input
          id="icp-name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Heads of Sales · B2B SaaS"
          className={INPUT}
        />
      </div>

      {CHIP_GROUPS.slice(0, 2).map((g) => (
        <ChipGroup
          key={g.key}
          field={g.key}
          label={g.label}
          placeholder={g.placeholder}
          chips={chips[g.key]}
          max={BUYERS_CAPS[g.key]}
          onAdd={(v) => addChip(g.key, v)}
          onRemove={(c) => removeChip(g.key, c)}
        />
      ))}

      <section>
        <h3 className={GROUP_HEADER}>Company size · {sizes.length}</h3>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {BUYERS_SIZE_BUCKETS.map((size) => {
            const on = sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSize(size)}
                className={cn(
                  CHIP,
                  "font-data tabular-nums transition-colors",
                  on
                    ? "border-[var(--cyan-line)] bg-[var(--fb-tint)] text-foreground"
                    : "text-[var(--ink-3)] hover:border-[rgba(12,16,26,0.16)]"
                )}
              >
                {size}
              </button>
            );
          })}
        </div>
        {BUYERS_SIZE_BUCKETS.filter((s) => sizes.includes(s)).map((s) => (
          <input key={s} type="hidden" name="companySizes[]" value={s} />
        ))}
        <p className={HINT}>Employees at the buyer&rsquo;s company.</p>
      </section>

      {CHIP_GROUPS.slice(2).map((g) => (
        <ChipGroup
          key={g.key}
          field={g.key}
          label={g.label}
          placeholder={g.placeholder}
          chips={chips[g.key]}
          max={BUYERS_CAPS[g.key]}
          onAdd={(v) => addChip(g.key, v)}
          onRemove={(c) => removeChip(g.key, c)}
        />
      ))}

      <section className="border-t border-[rgba(12,16,26,0.08)] pt-6">
        <h3 className={GROUP_HEADER}>Exclusions</h3>
        <div className="mt-3 flex flex-col gap-3">
          <Toggle
            name="excludeAgencies"
            label="Skip agencies and consultants"
            checked={excludeAgencies}
            onChange={setExcludeAgencies}
          />
          <Toggle
            name="excludeFreelancers"
            label="Skip freelancers and the self-employed"
            checked={excludeFreelancers}
            onChange={setExcludeFreelancers}
          />
        </div>
        <div className="mt-5">
          <FieldLabel htmlFor="icp-competitors">Competitors</FieldLabel>
          <textarea
            id="icp-competitors"
            name="competitors"
            rows={3}
            defaultValue={value.targeting.competitors.join("\n")}
            placeholder="One company per line"
            className={TEXTAREA}
          />
          <p className={HINT}>Their people are never contacted.</p>
        </div>
      </section>

      <details className="group/details">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[0.85rem] font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown
            aria-hidden
            className="size-4 -rotate-90 text-[var(--ink-4)] transition-transform group-open/details:rotate-0"
          />
          Who to prioritize or avoid
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          {LISTS.map((l) => (
            <div key={l.name}>
              <FieldLabel htmlFor={`icp-${l.name}`}>{l.label}</FieldLabel>
              <textarea
                id={`icp-${l.name}`}
                name={l.name}
                rows={3}
                defaultValue={value.targeting[l.name].join("\n")}
                className={TEXTAREA}
              />
              <p className={HINT}>{l.hint}</p>
            </div>
          ))}
          <div>
            <FieldLabel htmlFor="icp-guidance">In your own words</FieldLabel>
            <textarea
              id="icp-guidance"
              name="guidance"
              rows={3}
              maxLength={500}
              defaultValue={value.targeting.guidance ?? ""}
              placeholder="e.g. Prioritize founders at B2B SaaS companies; avoid anyone in education."
              className={TEXTAREA}
            />
            <p className={HINT}>Your agents weigh this when scoring — it never lowers the quality bar.</p>
          </div>
        </div>
      </details>

      <FormError message={error} />

      <div className="flex flex-col gap-3">
        <Submit mode={mode} disabled={regenerating} />
        {onRegenerate && <RegenerateButton onRegenerate={onRegenerate} regenerating={regenerating} />}
      </div>

      {mode === "onboarding" ? (
        // plain text: /settings is gated until onboarding completes, so a link would bounce here
        <p className="text-center text-[0.8rem] text-[var(--ink-3)]">
          Drafted from your website. You can refine your positioning later in Settings.
        </p>
      ) : (
        <p className="text-center text-[0.8rem] text-[var(--ink-3)]">
          Where this came from →{" "}
          <Link href="/settings/positioning" className="font-medium text-foreground underline-offset-4 hover:underline">
            Settings › Positioning
          </Link>
        </p>
      )}
    </div>
  );
}

function Submit({ mode, disabled }: { mode: "onboarding" | "settings"; disabled: boolean }) {
  const { pending } = useFormStatus();
  const idle =
    mode === "onboarding" ? (
      <>
        These are my buyers
        <CtaArrow />
      </>
    ) : (
      "Save targeting"
    );
  return (
    <SubmitButton
      pending={pending || disabled}
      idle={idle}
      // disabled-but-not-submitting (a redraft in flight) keeps the idle label
      busy={
        pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {mode === "onboarding" ? "Setting up your agents…" : "Saving…"}
          </>
        ) : (
          idle
        )
      }
    />
  );
}

/** Disabled while the form submits or a redraft is in flight — one write at a time. */
function RegenerateButton({ onRegenerate, regenerating }: { onRegenerate: () => void; regenerating: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onRegenerate}
      disabled={regenerating || pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-[0.85rem] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground disabled:opacity-60"
    >
      {regenerating ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Rewriting your buyer profile…
        </>
      ) : (
        <>
          <RefreshCw className="size-4" />
          Redraft from my website
        </>
      )}
    </button>
  );
}

function ChipGroup({
  field,
  label,
  placeholder,
  chips,
  max,
  onAdd,
  onRemove,
}: {
  field: ChipKey;
  label: string;
  placeholder: string;
  chips: string[];
  max: number;
  onAdd: (v: string) => void;
  onRemove: (chip: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const full = chips.length >= max;
  const commit = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <section>
      <h3 className={GROUP_HEADER}>
        {label} · {chips.length}
      </h3>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <span key={chip} className={CHIP}>
            {chip}
            <input type="hidden" name={`${field}[]`} value={chip} />
            <button
              type="button"
              onClick={() => onRemove(chip)}
              aria-label={`Remove ${chip}`}
              className="-mr-1 grid size-5 place-items-center rounded-full text-[var(--ink-4)] transition-colors hover:bg-[var(--tint)] hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {!full && (
          <span className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-[rgba(12,16,26,0.16)] pl-3 pr-1">
            <label htmlFor={inputId} className="sr-only">
              {placeholder}
            </label>
            <input
              id={inputId}
              value={draft}
              maxLength={BUYERS_CAPS.entry}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder={placeholder}
              className="w-40 bg-transparent text-[0.85rem] text-foreground outline-none placeholder:text-[var(--ink-4)]"
            />
            <button
              type="button"
              onClick={commit}
              disabled={!draft.trim()}
              aria-label={`Add to ${label.toLowerCase()}`}
              className="grid size-6 place-items-center rounded-full text-[var(--ink-3)] transition-colors hover:bg-[var(--tint)] hover:text-foreground disabled:opacity-40"
            >
              <Plus className="size-3.5" />
            </button>
          </span>
        )}
      </div>
      {full && <p className={HINT}>That&rsquo;s the most we use — remove one to add another.</p>}
    </section>
  );
}

/** A checkbox whose value always posts ("on" / "off"), so an untouched default stays explicit. */
function Toggle({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[0.9rem] text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--acc)]"
      />
      <input type="hidden" name={name} value={checked ? "on" : "off"} />
      {label}
    </label>
  );
}

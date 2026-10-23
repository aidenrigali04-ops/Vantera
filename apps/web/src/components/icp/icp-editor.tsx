"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/form-error";
import { FieldLabel, INPUT } from "@/app/onboarding/onboarding-ui";
import { BUYERS_CAPS, BUYERS_SIZE_BUCKETS, type BuyersFormValues } from "@/lib/validation/buyers";
import { RegenerateButton, Submit } from "./buttons";
import { ChipGroup, type ChipKey } from "./chip-group";
import { CHIP, GROUP_HEADER, HINT, TEXTAREA } from "./styles";
import { Toggle } from "./toggle";

/**
 * The buyer-profile editor — one component, two placements (onboarding "Your buyers" and the
 * Playbook targeting page). Renders inside the caller's <form> and emits the plain repeated
 * fields `parseBuyersForm` reads (`titles[]`, …, `excludeAgencies`, `competitors`, `guidance`).
 * No network: regenerating is the caller's job (`onRegenerate`).
 */

export type IcpEditorValue = BuyersFormValues;

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

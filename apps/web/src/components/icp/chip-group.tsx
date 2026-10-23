"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { BUYERS_CAPS } from "@/lib/validation/buyers";
import { CHIP, GROUP_HEADER, HINT } from "./styles";

export type ChipKey = "titles" | "industries" | "geos" | "signals";

export function ChipGroup({
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

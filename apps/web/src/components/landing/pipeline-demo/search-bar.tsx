"use client";

import { Search, CornerDownLeft } from "lucide-react";
import { AnimatedPanelBorder } from "@/components/ui/animated-border";
import { WARM_BEAM, WARM_GRADIENT } from "../landing-theme";
import { ICP_PRESETS } from "./sim-data";

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onPreset,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onPreset: (id: string, query: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="relative rounded-2xl"
      >
        <div className="relative flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] p-2 pl-4 backdrop-blur-md transition-shadow focus-within:ring-2 focus-within:ring-white/25">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <label htmlFor="icp-search" className="sr-only">
            Describe your target audience
          </label>
          <input
            id="icp-search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe who you want to reach — e.g. VPs of Sales at B2B SaaS"
            className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/80"
            autoComplete="off"
          />
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-background transition-transform hover:scale-[1.02] active:scale-100"
            style={{ backgroundImage: WARM_GRADIENT }}
          >
            Run pipeline
            <CornerDownLeft className="size-3.5" />
          </button>
        </div>
        <AnimatedPanelBorder radius={16} gradient={WARM_BEAM} />
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground/70">try:</span>
        {ICP_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p.id, p.query)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-foreground/70 transition-colors hover:border-white/25 hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

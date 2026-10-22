"use client";

/** A checkbox whose value always posts ("on" / "off"), so an untouched default stays explicit. */
export function Toggle({
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

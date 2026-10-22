import { cn } from "@/lib/utils";

/**
 * Three rows of qualified prospects drifting past under the showcase, after
 * Rankaria's rows of directory domains: each card a person the agents found,
 * with the fit score they earned. Rows alternate direction and hold still under
 * the pointer (`landing-marquee` in globals.css). Decorative and sample data:
 * aria-hidden, nothing focusable.
 */

type Prospect = { name: string; role: string; fit: number; tint: string };

const ROWS: Prospect[][] = [
  [
    { name: "Rachel Nguyen", role: "VP Sales · Northwind", fit: 94, tint: "#1877f2" },
    { name: "Tomás Herrera", role: "Founder · Quillstack", fit: 88, tint: "#0f9d6e" },
    { name: "Hannah Brooks", role: "Head of Growth · Tidewater", fit: 91, tint: "#c2557d" },
    { name: "Kenji Watanabe", role: "CRO · Kestrel", fit: 86, tint: "#5e6ad2" },
    { name: "Amara Diallo", role: "RevOps Lead · Copperleaf", fit: 92, tint: "#d97706" },
    { name: "Owen Gallagher", role: "Agency Owner · Paperplane", fit: 84, tint: "#0c9fce" },
    { name: "Sofia Marchetti", role: "COO · Fernway", fit: 90, tint: "#7c3aed" },
    { name: "Daniel Cho", role: "Sales Director · Summit Ridge", fit: 87, tint: "#0f766e" },
  ],
  [
    { name: "Marcus Feld", role: "Head of Growth · Lumen", fit: 91, tint: "#5e6ad2" },
    { name: "Ingrid Larsen", role: "Managing Partner · Brookline", fit: 85, tint: "#0c9fce" },
    { name: "Ravi Menon", role: "Founder & CEO · Vela Robotics", fit: 93, tint: "#1877f2" },
    { name: "Chloe Bernard", role: "Demand Gen Lead · Pinecrest", fit: 82, tint: "#c2557d" },
    { name: "Samuel Osei", role: "VP Partnerships · Halcyon", fit: 89, tint: "#0f9d6e" },
    { name: "Mei Lin", role: "Head of Sales · Ember Studio", fit: 90, tint: "#d97706" },
    { name: "Lucas Moreau", role: "Founder · Marlow Legal", fit: 86, tint: "#7c3aed" },
    { name: "Fatima Rahman", role: "CEO · Harbor & Co", fit: 92, tint: "#0f766e" },
  ],
  [
    { name: "Aisha Okafor", role: "Founder · Brightlane", fit: 89, tint: "#0f9d6e" },
    { name: "Ben Whitaker", role: "Sales Lead · Orbital", fit: 87, tint: "#d97706" },
    { name: "Elena Petrova", role: "VP Revenue · Lattice Row", fit: 91, tint: "#5e6ad2" },
    { name: "Jamal Carter", role: "Head of BD · Northgate", fit: 84, tint: "#1877f2" },
    { name: "Nora Lindqvist", role: "COO · Fieldnote", fit: 90, tint: "#c2557d" },
    { name: "Arjun Kapoor", role: "Founder · Ledgerline", fit: 93, tint: "#0c9fce" },
    { name: "Grace Kim", role: "Growth Lead · Meridian", fit: 88, tint: "#7c3aed" },
    { name: "Paulo Santos", role: "Partner · Cobalt Advisory", fit: 85, tint: "#0f766e" },
  ],
];

const SPEEDS = ["72s", "88s", "80s"];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

function Card({ p }: { p: Prospect }) {
  const high = p.fit >= 90;
  return (
    <li className="flex h-[60px] w-[248px] shrink-0 items-center gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 shadow-[var(--shadow-sm)]">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: p.tint }}
      >
        {initials(p.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium leading-tight text-foreground">
          {p.name}
        </span>
        <span className="block truncate text-[11.5px] leading-tight text-[var(--ink-4)]">{p.role}</span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          high ? "bg-[#e3f5ea] text-[#13824a]" : "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]",
        )}
      >
        Fit {p.fit}
      </span>
    </li>
  );
}

export function ProspectRows() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]"
    >
      {ROWS.map((row, i) => (
        <ul
          key={i}
          data-reverse={i % 2 === 1 ? "" : undefined}
          className="landing-marquee flex w-max gap-3 pr-3"
          style={{ "--marquee-s": SPEEDS[i] } as React.CSSProperties}
        >
          {/* Twice over, so sliding half the row's width loops seamlessly (the
              trailing pr-3 makes the two halves exactly equal). */}
          {[...row, ...row].map((p, j) => (
            <Card key={j} p={p} />
          ))}
        </ul>
      ))}
    </div>
  );
}

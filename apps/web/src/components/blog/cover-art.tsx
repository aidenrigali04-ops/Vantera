import type { ReactNode } from "react";
import type { BlogPost } from "@/lib/blog";
import { cn } from "@/lib/utils";

/**
 * A post's cover, generated rather than drawn: after rankbox.xyz's blog covers (in turn
 * after Webflow's) — a flat field of two or three brand colours, oversized shapes
 * cropped by the frame, dashed wires between ringed nodes, and no headline. The scene
 * pictures what the post is about in Vantera's terms: a shield for safety, two marks
 * facing off for a comparison, a radar finding a buyer for a playbook, and the Vantera
 * mark otherwise.
 *
 * Everything derives from the slug, so a post always gets the same cover and server and
 * client renders match. The art is one SVG canvas scaled to cover its box, so it reads
 * the same as a card thumbnail and as a hero. No gradients or filters, so no ids to keep
 * unique on a page that shows a cover twice.
 */

/* One canvas for every scene; the article hero's crop keeps x 110–1490 readable. */
const W = 1600;
const H = 1000;

const BLUE = "#1877f2";
const BLACK = "#0a0c12";
const WHITE = "#ffffff";
/* The brand blue at about 7% on white: the light field. */
const PAPER = "#edf4fe";
/* The brand blue at about 22% on white: queued, not yet sent. */
const PALE = "#c9ddfc";

type Rand = () => number;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Small seeded PRNG (mulberry32): the same seed always draws the same cover. */
function random(seed: number): Rand {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const jitter = (rand: Rand, n: number) => (rand() - 0.5) * 2 * n;

/* Fisher–Yates on the seeded stream. Never `sort(() => rand() - 0.5)`: its result
   depends on each engine's sort algorithm, so the browser could draw a different cover
   than the server rendered. */
function shuffle<T>(rand: Rand, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* Trig results can differ in the last bit between engines; a tenth of a canvas unit
   is far below a pixel, and keeps the server's markup and the client's identical. */
const tenth = (n: number) => Math.round(n * 10) / 10;

/* ---------- glyphs ---------- */

interface Node {
  x: number;
  y: number;
  r: number;
}

/* A dashed line between two circles, trimmed to their edges. */
function Wire({ a, b, stroke }: { a: Node; b: Node; stroke: string }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  return (
    <line
      x1={a.x + (dx / d) * a.r}
      y1={a.y + (dy / d) * a.r}
      x2={b.x - (dx / d) * b.r}
      y2={b.y - (dy / d) * b.r}
      stroke={stroke}
      strokeWidth={5}
      strokeDasharray="14 16"
      strokeLinecap="round"
    />
  );
}

/* A ringed node: a solid disc with a white rim and a white pip. */
function Pip({ node, fill }: { node: Node; fill: string }) {
  return (
    <g>
      <circle cx={node.x} cy={node.y} r={node.r} fill={fill} stroke={WHITE} strokeWidth={7} />
      <circle cx={node.x} cy={node.y} r={node.r * 0.26} fill={WHITE} />
    </g>
  );
}

/* A 24-unit icon placed at a centre and size, in canvas units. */
function Glyph({
  cx,
  cy,
  size,
  children,
}: {
  cx: number;
  cy: number;
  size: number;
  children: ReactNode;
}) {
  return (
    <svg x={cx - size / 2} y={cy - size / 2} width={size} height={size} viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

/* The Vantera mark (vantera-logo.tsx): a rounded square turned 45° with a square cut
   from its centre. */
function VanteraMark({
  cx,
  cy,
  size,
  fill,
}: {
  cx: number;
  cy: number;
  size: number;
  fill: string;
}) {
  return (
    <svg x={cx - size / 2} y={cy - size / 2} width={size} height={size} viewBox="0 0 100 100">
      <path
        transform="rotate(45 50 50)"
        fillRule="evenodd"
        fill={fill}
        d="M36 18H64A18 18 0 0 1 82 36V64A18 18 0 0 1 64 82H36A18 18 0 0 1 18 64V36A18 18 0 0 1 36 18ZM37 37V63H63V37Z"
      />
    </svg>
  );
}

const LINKEDIN_PATH =
  "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z";

/* ---------- scenes ---------- */

/* Safety: a shield in a ringed white disc, wired to the week's sending pace — bars
   that stop under a dashed ceiling, the last few still queued. */
function ShieldScene({ seed }: { seed: number }) {
  const rand = random(seed);
  const dark = rand() < 0.4;
  const hub: Node = { x: 470, y: 500, r: 0 };
  const a: Node = { x: 1340 + jitter(rand, 50), y: 70 + jitter(rand, 30), r: 112 };
  const b: Node = { x: 130 + jitter(rand, 30), y: 910 + jitter(rand, 30), r: 96 };
  const c: Node = { x: 1250 + jitter(rand, 60), y: 1010, r: 74 };
  const wire = dark ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.85)";
  const bars = Array.from({ length: 9 }, () => 54 + Math.round(rand() * 66));
  return (
    <>
      <rect width={W} height={H} fill={dark ? BLACK : BLUE} />
      <Wire a={hub} b={{ x: 880, y: 500, r: 0 }} stroke={wire} />
      <Wire a={hub} b={a} stroke={wire} />
      <Wire a={hub} b={b} stroke={wire} />
      <Wire a={{ x: 1200, y: 500, r: 0 }} b={c} stroke={wire} />
      <Wire a={a} b={{ x: W + 20, y: a.y + 220, r: 0 }} stroke={wire} />
      {[a, b, c].map((n, i) => (
        <Pip key={i} node={n} fill={dark ? BLUE : BLACK} />
      ))}

      <circle cx={hub.x} cy={hub.y} r={288} fill="none" stroke={WHITE} strokeWidth={8} />
      <circle cx={hub.x} cy={hub.y} r={240} fill={WHITE} />
      <Glyph cx={hub.x} cy={hub.y + 6} size={262}>
        <path
          d="M12 2.2 19.6 5.1V11c0 4.9-3.2 8.9-7.6 10.6C7.6 19.9 4.4 15.9 4.4 11V5.1Z"
          fill={BLUE}
        />
        <path
          d="M8.4 11.8l2.5 2.5 4.8-5"
          fill="none"
          stroke={WHITE}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Glyph>

      <rect x={840} y={355} width={980} height={290} rx={145} fill="none" stroke={WHITE} strokeWidth={8} />
      <rect x={880} y={395} width={900} height={210} rx={105} fill={WHITE} />
      {/* The ceiling the pace never crosses. */}
      <line
        x1={950}
        y1={426}
        x2={1460}
        y2={426}
        stroke={BLACK}
        strokeOpacity={0.45}
        strokeWidth={4}
        strokeDasharray="10 12"
        strokeLinecap="round"
      />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={966 + i * 54}
          y={560 - h}
          width={30}
          height={h}
          rx={10}
          fill={i < 6 ? BLUE : PALE}
        />
      ))}
    </>
  );
}

/* A stand-in for a volume tool: plain geometry, never a real company's mark. */
function ToolShape({ kind, cx, cy, color }: { kind: number; cx: number; cy: number; color: string }) {
  const s = 74;
  const h = s / 2;
  switch (kind % 8) {
    case 0:
      return <circle cx={cx} cy={cy} r={h} fill={color} />;
    case 1:
      return <circle cx={cx} cy={cy} r={h - 7} fill="none" stroke={color} strokeWidth={14} />;
    case 2:
      return <rect x={cx - h} y={cy - h} width={s} height={s} rx={12} fill={color} />;
    case 3:
      return <path d={`M${cx} ${cy - h} L${cx + h} ${cy + h} L${cx - h} ${cy + h} Z`} fill={color} />;
    case 4:
      return (
        <g fill={color}>
          <rect x={cx - h} y={cy - 12} width={s} height={24} rx={6} />
          <rect x={cx - 12} y={cy - h} width={24} height={s} rx={6} />
        </g>
      );
    case 5:
      return (
        <g fill={color}>
          {[0.5, 0.78, 1].map((k, i) => (
            <rect key={i} x={cx - h + i * 27} y={cy + h - s * k} width={20} height={s * k} rx={5} />
          ))}
        </g>
      );
    case 6:
      return (
        <path d={`M${cx - h} ${cy + h / 2} A${h} ${h} 0 0 1 ${cx + h} ${cy + h / 2} Z`} fill={color} />
      );
    default:
      return (
        <g fill={color}>
          <circle cx={cx - 19} cy={cy} r={19} />
          <circle cx={cx + 19} cy={cy} r={19} />
        </g>
      );
  }
}

/* Comparison: a wall of interchangeable volume tools facing one quality-first tile —
   the Vantera mark, checked. */
function VersusScene({ seed }: { seed: number }) {
  const rand = random(seed);
  const light = rand() < 0.65;
  const order = shuffle(rand, [0, 1, 2, 3, 4, 5, 6, 7, 0]);
  const tile = 150;
  const gap = 26;
  const x0 = 140;
  const y0 = 500 - (3 * tile + 2 * gap) / 2;
  return (
    <>
      <rect width={W} height={H} fill={light ? PAPER : BLUE} />
      <circle
        cx={1190}
        cy={500}
        r={340}
        fill="none"
        stroke={light ? BLUE : WHITE}
        strokeOpacity={0.3}
        strokeWidth={4}
      />
      <circle cx={1190 + jitter(rand, 40)} cy={1060} r={260} fill={light ? BLUE : BLACK} opacity={light ? 0.12 : 0.35} />

      {order.map((kind, i) => {
        const x = x0 + (i % 3) * (tile + gap);
        const y = y0 + Math.floor(i / 3) * (tile + gap);
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={tile}
              height={tile}
              rx={26}
              fill={light ? WHITE : "rgba(255,255,255,0.1)"}
              stroke={light ? BLACK : "rgba(255,255,255,0.6)"}
              strokeWidth={light ? 5 : 4}
            />
            <ToolShape kind={kind} cx={x + tile / 2} cy={y + tile / 2} color={light ? BLACK : WHITE} />
          </g>
        );
      })}

      <circle cx={800} cy={500} r={78} fill={BLACK} stroke={light ? PAPER : BLUE} strokeWidth={10} />
      <text
        x={800}
        y={502}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={60}
        fontWeight={700}
        letterSpacing={-1}
        fill={WHITE}
      >
        vs
      </text>

      <rect x={980} y={290} width={420} height={420} rx={72} fill={light ? BLUE : WHITE} />
      <VanteraMark cx={1190} cy={500} size={250} fill={light ? WHITE : BLUE} />
      <circle cx={1380} cy={690} r={58} fill={BLACK} stroke={light ? PAPER : BLUE} strokeWidth={10} />
      <path
        d="M1356 690 L1374 708 L1406 674"
        fill="none"
        stroke={WHITE}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/* Playbook: a radar sweep over scattered prospects, one of them found and wired to
   the card the agent drafts from — fit score up top, the signal underneath. */
function RadarScene({ seed }: { seed: number }) {
  const rand = random(seed);
  const dark = rand() < 0.55;
  const c = { x: 470, y: 520 };
  const ring = dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.32)";
  const dots = Array.from({ length: 10 }, () => {
    const angle = rand() * Math.PI * 2;
    const dist = 90 + rand() * 350;
    return {
      x: tenth(c.x + Math.cos(angle) * dist),
      y: tenth(c.y + Math.sin(angle) * dist),
      r: tenth(9 + rand() * 5),
    };
  });
  const found = (-28 + jitter(rand, 8)) * (Math.PI / 180);
  const t = { x: tenth(c.x + Math.cos(found) * 300), y: tenth(c.y + Math.sin(found) * 300) };
  const sweepFrom = found - 0.5;
  const arc = (a: number) => `${tenth(c.x + Math.cos(a) * 450)} ${tenth(c.y + Math.sin(a) * 450)}`;
  return (
    <>
      <rect width={W} height={H} fill={dark ? BLACK : BLUE} />
      {[120, 230, 340, 450].map((r, i) => (
        <circle
          key={r}
          cx={c.x}
          cy={c.y}
          r={r}
          fill="none"
          stroke={ring}
          strokeWidth={3}
          strokeDasharray={i < 2 ? undefined : "6 14"}
        />
      ))}
      <line x1={c.x - 470} y1={c.y} x2={c.x + 470} y2={c.y} stroke={ring} strokeWidth={2} />
      <line x1={c.x} y1={c.y - 470} x2={c.x} y2={c.y + 470} stroke={ring} strokeWidth={2} />
      <path
        d={`M${c.x} ${c.y} L${arc(sweepFrom)} A450 450 0 0 1 ${arc(found + 0.04)} Z`}
        fill={WHITE}
        opacity={0.1}
      />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={WHITE} opacity={0.5} />
      ))}
      <circle cx={c.x} cy={c.y} r={14} fill={WHITE} />

      <Wire a={{ ...t, r: 62 }} b={{ x: 930, y: 500, r: 0 }} stroke="rgba(255,255,255,0.75)" />
      <circle cx={t.x} cy={t.y} r={62} fill="none" stroke={WHITE} strokeWidth={8} />
      <circle cx={t.x} cy={t.y} r={44} fill={dark ? BLUE : WHITE} />
      <rect x={t.x + 34} y={t.y - 148} width={88} height={88} rx={22} fill={WHITE} />
      <Glyph cx={t.x + 78} cy={t.y - 104} size={52}>
        <path d={LINKEDIN_PATH} fill={BLUE} />
      </Glyph>

      <rect x={930} y={300} width={600} height={400} rx={40} fill={WHITE} />
      <circle cx={1010} cy={392} r={46} fill={BLUE} />
      <VanteraMark cx={1010} cy={392} size={58} fill={WHITE} />
      <rect x={1080} y={368} width={240} height={22} rx={11} fill={BLACK} opacity={0.85} />
      <rect x={1080} y={404} width={170} height={16} rx={8} fill={BLACK} opacity={0.18} />
      <rect x={1350} y={366} width={136} height={56} rx={28} fill={PAPER} />
      <text
        x={1418}
        y={395}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={28}
        fontWeight={700}
        fill={BLUE}
      >
        Fit 94
      </text>
      <line x1={970} y1={472} x2={1490} y2={472} stroke={BLACK} strokeOpacity={0.08} strokeWidth={3} />
      {[0, 1].map((i) => (
        <g key={i}>
          <circle cx={992} cy={518 + i * 54} r={9} fill={BLUE} />
          <rect x={1016} y={509 + i * 54} width={i ? 260 : 340} height={18} rx={9} fill={BLACK} opacity={0.12} />
        </g>
      ))}
      <rect x={970} y={622} width={236} height={52} rx={26} fill={BLUE} />
      <text
        x={1088}
        y={649}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={24}
        fontWeight={700}
        fill={WHITE}
      >
        Opener sent
      </text>
    </>
  );
}

/* Anything else: the Vantera mark, oversized and cropped, wired to the outcome. */
function MarkScene({ seed }: { seed: number }) {
  const rand = random(seed);
  const dark = rand() < 0.3;
  const a: Node = { x: 1360 + jitter(rand, 40), y: 150 + jitter(rand, 40), r: 96 };
  const b: Node = { x: 1500 + jitter(rand, 30), y: 900, r: 80 };
  const hub: Node = { x: 1200, y: 500, r: 0 };
  const wire = dark ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.85)";
  return (
    <>
      <rect width={W} height={H} fill={dark ? BLACK : BLUE} />
      <VanteraMark cx={500} cy={520} size={860} fill={dark ? BLUE : WHITE} />
      <Wire a={hub} b={a} stroke={wire} />
      <Wire a={hub} b={b} stroke={wire} />
      {[a, b].map((n, i) => (
        <Pip key={i} node={n} fill={dark ? BLUE : BLACK} />
      ))}
      <rect x={930} y={400} width={880} height={200} rx={100} fill="none" stroke={WHITE} strokeWidth={8} />
      <rect x={966} y={436} width={808} height={128} rx={64} fill={WHITE} />
      <circle cx={1040} cy={500} r={18} fill={BLUE} />
      <text
        x={1076}
        y={502}
        dominantBaseline="central"
        fontSize={60}
        fontWeight={700}
        letterSpacing={-1.5}
        fill={BLACK}
      >
        Meeting booked
      </text>
    </>
  );
}

/* ---------- picking a scene ---------- */

type SceneName = "shield" | "versus" | "radar" | "mark";

const SCENES: Record<SceneName, (props: { seed: number }) => ReactNode> = {
  shield: ShieldScene,
  versus: VersusScene,
  radar: RadarScene,
  mark: MarkScene,
};

/* The category decides; the title breaks the tie for posts filed elsewhere. */
function sceneFor(post: Pick<BlogPost, "title" | "category">): SceneName {
  const category = post.category.toLowerCase();
  if (category === "safety" || /\bsafe|restrict|\bban\b/i.test(post.title)) return "shield";
  if (category === "comparison" || /alternative|\bvs\.?\b|compar/i.test(post.title)) return "versus";
  if (category === "playbook" || /buyer|intent|signal|find|prospect/i.test(post.title)) return "radar";
  return "mark";
}

export function CoverArt({
  post,
  className,
}: {
  post: Pick<BlogPost, "slug" | "title" | "category">;
  className?: string;
}) {
  const Scene = SCENES[sceneFor(post)];
  return (
    <div aria-hidden className={cn("relative overflow-hidden bg-[#1877f2]", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={{ fontFamily: "inherit" }}
      >
        <Scene seed={hash(post.slug)} />
      </svg>
    </div>
  );
}

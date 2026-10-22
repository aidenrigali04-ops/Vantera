"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The landing hero's backdrop: the Vantera mark drawn as a field of tiny "+"
 * and "·" glyphs, ringed by a dotted orbit. It turns slowly, a soft band of
 * light passes across it, and a fine pointer lights up the grid around itself.
 *
 * Drawn on a 2D canvas rather than WebGL: the field is a few thousand
 * rectangles, which a canvas paints in well under a millisecond, with no shader
 * runtime in the bundle. Each frame the mark is drawn into a tiny offscreen
 * canvas (one pixel per glyph cell), and that pixel's value decides which glyph
 * the cell gets. An ordered (Bayer) dither turns the in-between values into the
 * mixed "+"/"·" texture instead of a flat fill.
 *
 * It renders an empty canvas on the server and fades itself in once mounted.
 * It stops drawing while scrolled out of view, and with reduced motion it draws
 * one still frame and ignores the pointer.
 */

/* The mark in a 100-unit box, before its 45° turn (vantera-logo.tsx): a
   rounded square with a square cut from its centre. Filled even-odd, the cut
   stays open. */
const MARK_PATH =
  "M36 18H64A18 18 0 0 1 82 36V64A18 18 0 0 1 64 82H36A18 18 0 0 1 18 64V36A18 18 0 0 1 36 18Z" +
  "M37 37V63H63V37Z";

/* CSS px per glyph cell. Small enough to read as texture, large enough that a
   glyph is a recognisable "+" rather than a smudge. */
const CELL = 9;
/* 4×4 Bayer matrix, as thresholds in (0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
/* 30fps is plenty for motion this slow, and halves the work. */
const FRAME_MS = 1000 / 30;
/* One full turn of the mark, in seconds. Slow enough to feel ambient. */
const TURN_S = 120;
/* The light band crosses the mark every this many seconds. */
const SWEEP_S = 7;
const FADE_IN_MS = 1600;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export function MarkDither({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const sampler = document.createElement("canvas");
    const sctx = sampler.getContext("2d", { willReadFrequently: true });
    if (!ctx || !sctx) return;

    const mark = new Path2D(MARK_PATH);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let color = "#1877f2";

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      cols = Math.max(1, Math.ceil(width / CELL));
      rows = Math.max(1, Math.ceil(height / CELL));
      sampler.width = cols;
      sampler.height = rows;
      // The glyph colour comes from CSS (`text-*` on the canvas), so the
      // backdrop follows the brand token rather than a second hard-coded blue.
      color = getComputedStyle(canvas).color || color;
    };

    /* Paints the mark and its orbit into the sampler, one pixel per cell, and
       returns the pixels. Each layer gets its own colour channel (red: the
       mark's fill, green: its outline, blue: the orbit) so the glyph pass can
       weight them separately. They are added onto black, so a cell's channel
       value is simply how much of that layer covers it. */
    const sample = (t: number) => {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = "source-over";
      sctx.fillStyle = "#000";
      sctx.fillRect(0, 0, cols, rows);
      sctx.globalCompositeOperation = "lighter";
      // Sized off the height so the mark fills the band behind the copy with
      // its points clear of the frame at any angle; the width cap keeps it
      // from swallowing a narrow phone screen.
      const size = Math.min(rows * 1.02, cols * 0.62);
      const turn = (t / TURN_S) * Math.PI * 2;
      sctx.translate(cols / 2, rows / 2);

      // Dotted orbit, turning against the mark. Its radius overshoots the
      // canvas height, so the frame crops it top and bottom.
      sctx.save();
      sctx.rotate(-turn * 1.5);
      sctx.strokeStyle = "#00f";
      sctx.lineWidth = 1.8;
      sctx.setLineDash([2.6, 2.2]);
      sctx.beginPath();
      sctx.arc(0, 0, size * 0.56, 0, Math.PI * 2);
      sctx.stroke();
      sctx.restore();

      // The mark: a light fill under a dense outline, so the silhouette reads
      // at a glance instead of as a solid blob of glyphs.
      sctx.rotate(turn + Math.PI / 4);
      sctx.scale(size / 100, size / 100);
      sctx.translate(-50, -50);
      sctx.fillStyle = "#f00";
      sctx.fill(mark, "evenodd");
      sctx.strokeStyle = "#0f0";
      sctx.lineWidth = 4.2;
      sctx.lineJoin = "round";
      sctx.stroke(mark);
      return sctx.getImageData(0, 0, cols, rows).data;
    };

    // The pointer eases toward where it really is, so the light trails a
    // little behind a fast flick instead of snapping cell to cell.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0, seen: false };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - r.left) / CELL;
      pointer.ty = (e.clientY - r.top) / CELL;
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      pointer.ta = inside ? 1 : 0;
      if (!pointer.seen) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
        pointer.seen = true;
      }
    };

    const start = performance.now();
    let last = 0;
    let raf = 0;
    let visible = true;

    const draw = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      const data = sample(t);
      const intro = reduce ? 1 : easeOut((now - start) / FADE_IN_MS);

      pointer.x += (pointer.tx - pointer.x) * 0.14;
      pointer.y += (pointer.ty - pointer.y) * 0.14;
      pointer.a += (pointer.ta - pointer.a) * 0.08;

      // The light band: a soft diagonal stripe that travels across the mark,
      // then rests off-canvas for the back half of its cycle.
      const span = Math.hypot(cols, rows) * 0.5;
      const phase = (t % SWEEP_S) / SWEEP_S;
      const bandPos = -span + phase * 2 * span * 1.6;
      const bandWidth = rows * 0.22;

      const cx = cols / 2;
      const cy = rows / 2;
      const reach = Math.min(cols, rows) * 0.62;
      const glow = 9; // pointer radius, in cells

      const px = CELL * dpr;
      const dot = Math.max(1, Math.round(1.35 * dpr));
      const thin = Math.max(1, Math.round(1.05 * dpr));
      const thick = Math.max(1, Math.round(1.35 * dpr));
      const armSm = Math.round(5 * dpr) | 1;
      const armLg = Math.round(6.4 * dpr) | 1;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;

      // One path per glyph weight, so the frame is three fills, not thousands.
      const dots = new Path2D();
      const pluses = new Path2D();
      const bold = new Path2D();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 4;
          const fill = data[i] / 255;
          const edge = data[i + 1] / 255;
          const orbit = data[i + 2] / 255;
          const cover = Math.max(fill, edge);

          // Outline strongest, orbit next, fill lightest: the silhouette
          // carries the shape and the fill reads as texture inside it.
          const base = Math.max(edge * 0.9, orbit * 0.74, fill * 0.4);
          if (base < 0.02 && pointer.a < 0.01) continue;

          // Brighter toward the centre, so the mark has a little depth, and
          // lifted further where the light band is passing.
          const dx = c - cx;
          const dy = r - cy;
          const depth = 1 - 0.2 * Math.min(1, Math.hypot(dx, dy) / reach);
          const along = (dx + dy) * 0.7071;
          const band = Math.exp(-((along - bandPos) ** 2) / (2 * bandWidth * bandWidth));
          let v = (base + band * 0.32 * Math.max(cover, orbit * 0.6)) * depth;

          if (pointer.a > 0.01) {
            const pd = (c - pointer.x) ** 2 + (r - pointer.y) ** 2;
            const lit = Math.exp(-pd / (2 * glow * glow)) * pointer.a;
            // Off the mark the pointer reveals a faint grid of dots; on it, the
            // glyphs step up a weight.
            v += lit * (0.55 + 0.4 * cover);
          }
          if (v < 0.06) continue;

          const level = Math.floor(v * 3.15 + (BAYER[(r & 3) * 4 + (c & 3)] - 0.5) * 0.9);
          if (level <= 0) continue;

          const x = Math.round(c * px + px / 2);
          const y = Math.round(r * px + px / 2);
          if (level === 1) {
            dots.rect(x - (dot >> 1), y - (dot >> 1), dot, dot);
          } else if (level === 2) {
            pluses.rect(x - (armSm >> 1), y - (thin >> 1), armSm, thin);
            pluses.rect(x - (thin >> 1), y - (armSm >> 1), thin, armSm);
          } else {
            bold.rect(x - (armLg >> 1), y - (thick >> 1), armLg, thick);
            bold.rect(x - (thick >> 1), y - (armLg >> 1), thick, armLg);
          }
        }
      }

      ctx.globalAlpha = 0.5 * intro;
      ctx.fill(dots);
      ctx.globalAlpha = 0.78 * intro;
      ctx.fill(pluses);
      ctx.globalAlpha = intro;
      ctx.fill(bold);
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (now - last >= FRAME_MS) {
        last = now;
        draw(now);
      }
      raf = window.requestAnimationFrame(loop);
    };
    const run = () => {
      if (!raf && visible) raf = window.requestAnimationFrame(loop);
    };

    resize();
    if (reduce) {
      draw(start);
    } else {
      run();
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduce) draw(performance.now());
    });
    resizeObserver.observe(canvas);

    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!reduce) run();
    });
    viewObserver.observe(canvas);

    if (finePointer && !reduce) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      viewObserver.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none block h-full w-full text-[var(--fb)]", className)}
    />
  );
}

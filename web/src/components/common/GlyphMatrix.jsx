"use client";

import { useEffect, useRef } from "react";

/**
 * GlyphMatrix — animated grid of subtly shifting glyphs (from magicui).
 *
 * Ported from the TSX original: no `"use client"` (a Next.js directive with no
 * meaning in Vite), no TypeScript, no Tailwind `cn()`, and no `next-themes` —
 * this site is light-only, so `color` is passed in directly.
 */
export default function GlyphMatrix({
  glyphs = "01·•+*/\\<>=",
  cellSize = 14,
  mutationRate = 0.04,
  interval = 90,
  className = "",
  fadeBottom = 0.6,
  color = "#6B7280",
  style,
  ...props
}) {
  const canvasRef = useRef(null);
  // Glyph colour as RGBA, in a ref so a colour change recolours the next frame
  // without restarting the animation.
  const rgbaRef = useRef({ r: 107, g: 114, b: 128, a: 1 });

  useEffect(() => {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const probeCtx = probe.getContext("2d");
    if (!probeCtx) return;
    // Seed with the default so an invalid colour falls back to it — a 2d
    // context keeps the previous fillStyle rather than turning black.
    probeCtx.fillStyle = "#6B7280";
    probeCtx.fillStyle = color;
    probeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
    rgbaRef.current = { r, g, b, a: a / 255 };
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cols = 0;
    let rows = 0;
    let cells = [];
    let alphas = [];
    let raf = 0;
    let last = 0;
    let stopped = false;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = canvas;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(w / cellSize);
      rows = Math.ceil(h / cellSize);

      cells = new Array(cols * rows)
        .fill(0)
        .map(() => glyphs[Math.floor(Math.random() * glyphs.length)]);
      alphas = new Array(cols * rows).fill(0).map(() => 0.05 + Math.random() * 0.35);
    };

    const draw = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      ctx.font = `${cellSize - 2}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";

      const { r, g, b, a: colorAlpha } = rgbaRef.current;
      for (let y = 0; y < rows; y++) {
        const fade = fadeBottom > 0 ? 1 - (y / rows) * fadeBottom : 1;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const a = alphas[i] * fade * colorAlpha;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
          ctx.fillText(cells[i], x * cellSize, y * cellSize);
        }
      }
    };

    const tick = (t) => {
      if (stopped) return;

      if (t - last >= interval) {
        last = t;

        const total = cols * rows;
        const mutations = Math.max(1, Math.floor(total * mutationRate));

        for (let n = 0; n < mutations; n++) {
          const i = Math.floor(Math.random() * total);
          cells[i] = glyphs[Math.floor(Math.random() * glyphs.length)];
          alphas[i] = 0.05 + Math.random() * 0.45;
        }

        draw();
      }

      raf = requestAnimationFrame(tick);
    };

    resize();
    draw();
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);

    // Backgrounded tabs still burn CPU on this loop otherwise — it's purely
    // decorative, so pausing while hidden and resuming on return is invisible.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [glyphs, cellSize, mutationRate, interval, fadeBottom]);

  return (
    <canvas
      ref={canvasRef}
      className={`glyph-matrix ${className}`.trim()}
      // Sizing lives in .glyph-matrix; `style` stays a passthrough so a caller
      // can still override it per instance.
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

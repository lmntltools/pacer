import { useEffect, useRef, useState } from "react";
import { percentile } from "../engine/stats";
import type { ThroughputSample, Unit } from "../engine/types";
import { formatSpeed, toUnit, unitLabel } from "../lib/format";

interface Props {
  samples: ThroughputSample[];
  unit: Unit;
  reducedMotion: boolean;
  active: boolean;
  /** Repaint trigger — canvas colors are read from the token layer per draw. */
  theme: string;
  windowMs?: number;
}

const PAD = { top: 18, right: 52, bottom: 22, left: 4 };

/** Read a resolved CSS custom property off :root (so the plot tracks the theme). */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function Oscilloscope({ samples, unit, reducedMotion, active, theme, windowMs = 13000 }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // resolve theme colors at draw time
    const cSignal = cssVar("--signal", "#2e5bff");
    const cLine = cssVar("--line", "rgba(23,25,27,0.14)");
    const cLineSoft = cssVar("--line-soft", "rgba(23,25,27,0.08)");
    const cAxis = cssVar("--ink-40", "#606469");
    const cEmpty = cssVar("--cell-empty", "rgba(23,25,27,0.07)");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const plotW = size.w - PAD.left - PAD.right;
    const plotH = size.h - PAD.top - PAD.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    const values = samples.map((s) => toUnit(s.mbps, unit));
    // Scale the y-axis to the ~92nd percentile, NOT the raw max. This keeps a
    // single XHR send-buffer spike from squashing the meaningful signal flat.
    const robustPeak = values.length ? percentile(values, 92) : 0;
    const floor = unit === "mbps" ? 10 : 1;
    const maxY = niceCeil(Math.max(robustPeak * 1.18, floor));
    const lastT = samples.length ? samples[samples.length - 1].t : 0;
    const maxT = Math.max(windowMs, lastT);

    const xOf = (t: number) => PAD.left + (t / maxT) * plotW;
    const yOf = (v: number) => PAD.top + plotH - (Math.min(v, maxY) / maxY) * plotH;

    ctx.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";

    // horizontal gridlines + right-edge axis labels
    const rows = 4;
    for (let i = 0; i <= rows; i++) {
      const v = (maxY / rows) * i;
      const y = yOf(v);
      ctx.strokeStyle = i === 0 ? cLine : cLineSoft;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, Math.round(y) + 0.5);
      ctx.lineTo(PAD.left + plotW, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = cAxis;
      ctx.textAlign = "left";
      ctx.fillText(i === 0 ? "0" : formatAxis(v), PAD.left + plotW + 8, y);
    }

    // faint vertical time ticks every 2s
    ctx.textAlign = "center";
    for (let t = 2000; t < maxT; t += 2000) {
      const x = xOf(t);
      ctx.strokeStyle = cEmpty;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, PAD.top);
      ctx.lineTo(Math.round(x) + 0.5, PAD.top + plotH);
      ctx.stroke();
      ctx.fillStyle = cAxis;
      ctx.fillText(`${t / 1000}s`, x, PAD.top + plotH + 11);
    }

    if (samples.length >= 2) {
      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
      grad.addColorStop(0, withAlpha(cSignal, 0.18));
      grad.addColorStop(1, withAlpha(cSignal, 0));
      ctx.beginPath();
      ctx.moveTo(xOf(samples[0].t), yOf(values[0]));
      for (let i = 1; i < samples.length; i++) ctx.lineTo(xOf(samples[i].t), yOf(values[i]));
      ctx.lineTo(xOf(lastT), PAD.top + plotH);
      ctx.lineTo(xOf(samples[0].t), PAD.top + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // the trace — flat cobalt, no glow (borders/color carry the design, not blur)
      ctx.beginPath();
      ctx.moveTo(xOf(samples[0].t), yOf(values[0]));
      for (let i = 1; i < samples.length; i++) ctx.lineTo(xOf(samples[i].t), yOf(values[i]));
      ctx.strokeStyle = cSignal;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();

      if (active) {
        const lx = xOf(lastT);
        const ly = yOf(values[values.length - 1]);
        ctx.strokeStyle = withAlpha(cSignal, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, PAD.top + plotH);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = cSignal;
        ctx.fill();
      }
    }
  }, [samples, unit, size, active, windowMs, reducedMotion, theme]);

  const current = samples.length ? samples[samples.length - 1].mbps : 0;
  const peakMbps = samples.length ? Math.max(...samples.map((s) => s.mbps)) : 0;

  if (reducedMotion) {
    const pct = peakMbps > 0 ? Math.min(100, (current / peakMbps) * 100) : 0;
    return (
      <div
        ref={wrapRef}
        className="flex h-full w-full flex-col justify-end gap-3 px-1 pb-1"
        role="img"
        aria-label={`Throughput ${formatSpeed(current, unit)} ${unitLabel(unit)}`}
      >
        <div className="flex items-baseline justify-between">
          <span className="eng">Throughput</span>
          <span className="mono text-[11px] text-ink-40 tnum">
            peak {formatSpeed(peakMbps, unit)} {unitLabel(unit)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--cell-empty)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--signal)" }} />
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full" role="img" aria-label="Live throughput oscilloscope">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const b = Math.pow(10, exp);
  const f = n / b;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * b;
}

function formatAxis(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

/** Accepts #rgb / #rrggbb and returns an rgba() string at the given alpha. */
function withAlpha(color: string, alpha: number): string {
  const m = color.replace("#", "").trim();
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

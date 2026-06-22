import { useEffect, useRef, useState } from "react";
import { percentile } from "../engine/stats";
import type { ThroughputSample, Unit } from "../engine/types";
import { formatSpeed, toUnit, unitLabel } from "../lib/format";

interface Props {
  samples: ThroughputSample[];
  unit: Unit;
  color: string;
  reducedMotion: boolean;
  active: boolean;
  windowMs?: number;
}

const PAD = { top: 18, right: 52, bottom: 22, left: 4 };

export function Oscilloscope({ samples, unit, color, reducedMotion, active, windowMs = 13000 }: Props) {
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

    ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";

    // horizontal gridlines + right-edge axis labels
    const rows = 4;
    for (let i = 0; i <= rows; i++) {
      const v = (maxY / rows) * i;
      const y = yOf(v);
      ctx.strokeStyle = i === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.045)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, Math.round(y) + 0.5);
      ctx.lineTo(PAD.left + plotW, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = "rgba(110,120,134,0.9)";
      ctx.textAlign = "left";
      ctx.fillText(i === 0 ? "0" : formatAxis(v), PAD.left + plotW + 8, y);
    }

    // faint vertical time ticks every 2s
    ctx.textAlign = "center";
    for (let t = 2000; t < maxT; t += 2000) {
      const x = xOf(t);
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, PAD.top);
      ctx.lineTo(Math.round(x) + 0.5, PAD.top + plotH);
      ctx.stroke();
      ctx.fillStyle = "rgba(84,94,107,0.8)";
      ctx.fillText(`${t / 1000}s`, x, PAD.top + plotH + 11);
    }

    if (samples.length >= 2) {
      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
      grad.addColorStop(0, withAlpha(color, 0.28));
      grad.addColorStop(1, withAlpha(color, 0));
      ctx.beginPath();
      ctx.moveTo(xOf(samples[0].t), yOf(values[0]));
      for (let i = 1; i < samples.length; i++) ctx.lineTo(xOf(samples[i].t), yOf(values[i]));
      ctx.lineTo(xOf(lastT), PAD.top + plotH);
      ctx.lineTo(xOf(samples[0].t), PAD.top + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(xOf(samples[0].t), yOf(values[0]));
      for (let i = 1; i < samples.length; i++) ctx.lineTo(xOf(samples[i].t), yOf(values[i]));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.shadowColor = withAlpha(color, 0.55);
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (active) {
        const lx = xOf(lastT);
        const ly = yOf(values[values.length - 1]);
        ctx.strokeStyle = withAlpha(color, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, PAD.top + plotH);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [samples, unit, color, size, active, windowMs, reducedMotion]);

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
        <div className="flex items-baseline justify-between font-mono text-[11px] text-fg-faint">
          <span className="uppercase tracking-[0.18em]">Throughput</span>
          <span className="tnum">peak {formatSpeed(peakMbps, unit)} {unitLabel(unit)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
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

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

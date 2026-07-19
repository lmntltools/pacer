import { mbpsToMBytes } from "../engine/stats";
import type { Unit } from "../engine/types";

export function unitLabel(unit: Unit): string {
  return unit === "mbps" ? "Mbps" : "MB/s";
}

/**
 * The same speed expressed in the *other* unit, e.g. "≈ 60.7 MB/s" when the
 * headline is in Mbps. Surfaced under results so Mbps (what ISPs and tools like
 * Ookla quote) can't be misread against MB/s — they differ by exactly 8×.
 */
export function formatAltUnit(mbps: number | null | undefined, unit: Unit): string {
  if (mbps == null || !Number.isFinite(mbps)) return "";
  const other: Unit = unit === "mbps" ? "mbytes" : "mbps";
  return `≈ ${formatSpeed(mbps, other)} ${unitLabel(other)}`;
}

export function toUnit(mbps: number, unit: Unit): number {
  return unit === "mbps" ? mbps : mbpsToMBytes(mbps);
}

/** Adaptive precision so the hero number stays readable across 5 orders of magnitude. */
export function formatSpeed(mbps: number | null | undefined, unit: Unit): string {
  if (mbps == null || !Number.isFinite(mbps)) return "—";
  const v = toUnit(mbps, unit);
  if (v >= 1000) return v.toFixed(0);
  if (v >= 100) return v.toFixed(1);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function formatMs(ms: number | null | undefined, decimals = 0): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return ms.toFixed(decimals);
}

/** Human-friendly byte size for the "X MB transferred" line. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// CSS-var references so grade colors repaint with the light/dark token layer.
const GRADE_COLORS: Record<string, string> = {
  A: "var(--success-ink)",
  B: "var(--meter-green)",
  C: "var(--meter-amber)",
  D: "var(--meter-amber)",
  F: "var(--clip-text)",
};

export function gradeColor(grade: string | null): string {
  return grade ? (GRADE_COLORS[grade] ?? "var(--ink-40)") : "var(--ink-40)";
}

/** Classify a public IP as IPv4 or IPv6 from its shape. */
export function ipFamily(ip: string | null | undefined): "IPv4" | "IPv6" | "" {
  if (!ip) return "";
  if (ip.includes(":")) return "IPv6";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return "IPv4";
  return "";
}

import { mbpsToMBytes } from "../engine/stats";
import type { Unit } from "../engine/types";

export function unitLabel(unit: Unit): string {
  return unit === "mbps" ? "Mbps" : "MB/s";
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

const GRADE_COLORS: Record<string, string> = {
  A: "#3DF5C4",
  B: "#7CE0B0",
  C: "#FFB020",
  D: "#FF8A3D",
  F: "#FF5C5C",
};

export function gradeColor(grade: string | null): string {
  return grade ? (GRADE_COLORS[grade] ?? "#9AA4B2") : "#9AA4B2";
}

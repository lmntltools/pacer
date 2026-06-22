import { APP_NAME } from "../config";
import type { SpeedTestResult, Unit } from "../engine/types";
import { formatMs, formatSpeed, formatTimestamp, unitLabel } from "./format";

/** Build a clean, paste-able summary of a completed run. */
export function buildShareText(result: SpeedTestResult, unit: Unit): string {
  const u = unitLabel(unit);
  const lines: string[] = [];
  lines.push(`${APP_NAME} speed test — ${formatTimestamp(result.timestamp)}`);
  lines.push(
    `↓ ${formatSpeed(result.download?.mbps ?? null, unit)} ${u}   ` +
      `↑ ${formatSpeed(result.upload?.mbps ?? null, unit)} ${u}`,
  );
  if (result.latency) {
    lines.push(
      `Ping ${formatMs(result.latency.median)} ms (min ${formatMs(result.latency.min)}) · ` +
        `Jitter ${formatMs(result.latency.jitter)} ms`,
    );
  }
  if (result.bufferbloat.worst !== null) {
    lines.push(
      `Loaded latency +${formatMs(result.bufferbloat.worst)} ms (grade ${result.bufferbloat.grade})`,
    );
  }
  if (result.meta) {
    const m = result.meta;
    const isp = [m.isp, m.asn ? `AS${m.asn}` : ""].filter(Boolean).join(" · ");
    if (isp) lines.push(isp);
    const loc = [m.colo ? `Colo ${m.colo}` : "", m.country].filter(Boolean).join(" · ");
    if (loc) lines.push(loc);
    if (m.ip) lines.push(`IP ${m.ip}`);
  }
  return lines.join("\n");
}

/** Copy text to the clipboard, with a legacy fallback for non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

import type { MetaInfo } from "../engine/types";
import { ipFamily } from "../lib/format";

interface Props {
  meta: MetaInfo | null;
  /** Public IPv4 from the IPv4-only echo (the Worker usually sees IPv6). */
  ipv4: string | null;
  effectiveType: string | null;
  /** "panel" = tall idle display; "bar" = compact strip shown with results. */
  variant?: "panel" | "bar";
}

function detail(meta: MetaInfo, effectiveType: string | null): [string, string][] {
  const rows: [string, string][] = [];
  if (meta.asn) rows.push(["ASN", `AS${meta.asn}`]);
  if (meta.colo) rows.push(["Colo", meta.colo]);
  if (meta.country) rows.push(["Country", meta.country]);
  if (effectiveType) rows.push(["Net", effectiveType.toUpperCase()]);
  return rows;
}

/** Surfaces the connection info: IPv4 (the familiar one) up top, IPv6 below. */
export function ConnectionPanel({ meta, ipv4, effectiveType, variant = "panel" }: Props) {
  // Prefer the IPv4 dotted-quad as the headline; fall back to whatever the Worker saw.
  const primaryIp = ipv4 ?? meta?.ip ?? "";
  const primaryFamily = ipFamily(primaryIp);
  // Show the Worker-seen IP as a secondary line only if it's a *different* IPv6.
  const secondaryIp =
    meta?.ip && meta.ip !== primaryIp && ipFamily(meta.ip) === "IPv6" ? meta.ip : null;

  // ---- compact strip (shown beneath results) -------------------------------
  if (variant === "bar") {
    if (!meta && !primaryIp) return null;
    const tail = [
      meta?.isp,
      meta?.asn ? `AS${meta.asn}` : "",
      meta?.colo,
      meta?.country,
      effectiveType ? effectiveType.toUpperCase() : "",
    ].filter(Boolean) as string[];
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-white/[0.07] pt-4 font-mono text-[11px]">
        <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-fg-faint">Connection</span>
        {primaryIp && (
          <span className="flex items-baseline gap-1.5">
            {primaryFamily && <span className="text-[9px] uppercase tracking-wide text-accent-soft">{primaryFamily}</span>}
            <span className="break-all text-fg-dim">{primaryIp}</span>
          </span>
        )}
        {secondaryIp && (
          <span className="flex items-baseline gap-1.5">
            <span className="text-white/15">·</span>
            <span className="text-[9px] uppercase tracking-wide text-fg-faint">IPv6</span>
            <span className="break-all text-fg-faint">{secondaryIp}</span>
          </span>
        )}
        {tail.map((p, i) => (
          <span key={i} className="flex items-baseline gap-2">
            <span className="text-white/15">·</span>
            <span className="text-fg-dim">{p}</span>
          </span>
        ))}
      </div>
    );
  }

  // ---- tall panel (idle stage) ---------------------------------------------
  return (
    <div className="flex h-full flex-col justify-center rounded-xl border border-white/[0.07] bg-ink-850/40 px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(61,245,196,0.9)]" />
          Your connection
        </div>
        {primaryFamily && (
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-accent-soft">
            {primaryFamily}
          </span>
        )}
      </div>

      {!meta && !primaryIp ? (
        <div className="mt-4 font-mono text-sm text-fg-faint">Detecting…</div>
      ) : (
        <>
          <div className="mt-3 font-mono text-[clamp(1.1rem,2.4vw,1.7rem)] font-medium leading-tight text-fg break-all">
            {primaryIp || "—"}
          </div>
          {secondaryIp && (
            <div className="mt-1.5 flex items-baseline gap-2 font-mono text-[11px] text-fg-faint">
              <span className="uppercase tracking-wide">IPv6</span>
              <span className="break-all">{secondaryIp}</span>
            </div>
          )}
          <div className="mt-1.5 font-mono text-[13px] text-accent-soft">
            {meta?.isp || "Unknown ISP"}
          </div>

          {meta && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.07] pt-3.5">
              {detail(meta, effectiveType).map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-fg-faint">{k}</span>
                  <span className="mt-0.5 font-mono text-[13px] text-fg-dim tnum">{v}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-line pt-4">
        <span className="eng mr-1">Connection</span>
        {primaryIp && (
          <span className="flex items-baseline gap-1.5">
            {primaryFamily && <span className="eng !text-signal-ink">{primaryFamily}</span>}
            <span className="mono break-all text-[11px] text-ink-60">{primaryIp}</span>
          </span>
        )}
        {secondaryIp && (
          <span className="flex items-baseline gap-1.5">
            <span className="text-line-ctl">·</span>
            <span className="eng">IPv6</span>
            <span className="mono break-all text-[11px] text-ink-40">{secondaryIp}</span>
          </span>
        )}
        {tail.map((p, i) => (
          <span key={i} className="flex items-baseline gap-2.5">
            <span className="text-line-ctl">·</span>
            <span className="mono text-[11px] text-ink-60">{p}</span>
          </span>
        ))}
      </div>
    );
  }

  // ---- tall panel (idle stage) — a rack module -----------------------------
  // min-height (not h-full) so it lines up with the scope on desktop but grows
  // to fit its rows on a narrow phone instead of clipping the bottom line.
  return (
    <div className="flex min-h-[210px] flex-col justify-center rounded-mod border border-line bg-panel px-5 py-5 sm:min-h-[260px] sm:px-6 lg:min-h-[300px]">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft pb-3">
        <div className="flex items-center gap-2.5">
          <span className="led on-dark" style={{ backgroundColor: "var(--signal)", borderColor: "var(--signal)" }} aria-hidden="true" />
          <span className="eng">Your connection</span>
        </div>
        {primaryFamily && (
          <span className="eng rounded-ctrl border border-line px-1.5 py-0.5 !text-signal-ink">
            {primaryFamily}
          </span>
        )}
      </div>

      {!meta && !primaryIp ? (
        <div className="mono mt-4 text-sm text-ink-40">Detecting…</div>
      ) : (
        <>
          <div className="mono mt-4 break-all text-[clamp(1.1rem,2.4vw,1.7rem)] font-medium leading-tight text-ink">
            {primaryIp || "—"}
          </div>
          {secondaryIp && (
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="eng">IPv6</span>
              <span className="mono break-all text-[11px] text-ink-40">{secondaryIp}</span>
            </div>
          )}
          <div className="mono mt-2 text-[13px] text-signal-ink">{meta?.isp || "Unknown ISP"}</div>

          {meta && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5 border-t border-line-soft pt-3.5">
              {detail(meta, effectiveType).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1">
                  <span className="eng">{k}</span>
                  <span className="mono text-[13px] text-ink-60 tnum">{v}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

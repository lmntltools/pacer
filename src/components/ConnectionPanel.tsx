import type { MetaInfo } from "../engine/types";

interface Props {
  meta: MetaInfo | null;
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

/** Surfaces the connection info detected by the Worker's /meta route. */
export function ConnectionPanel({ meta, effectiveType, variant = "panel" }: Props) {
  // ---- compact strip (shown beneath results) -------------------------------
  if (variant === "bar") {
    if (!meta) return null;
    const parts = [
      meta.ip,
      meta.isp,
      meta.asn ? `AS${meta.asn}` : "",
      meta.colo,
      meta.country,
      effectiveType ? effectiveType.toUpperCase() : "",
    ].filter(Boolean);
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-white/[0.07] pt-4 font-mono text-[11px]">
        <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-fg-faint">Connection</span>
        {parts.map((p, i) => (
          <span key={i} className="flex items-baseline gap-2">
            {i > 0 && <span className="text-white/15">·</span>}
            <span className={i === 0 ? "break-all text-fg-dim" : "text-fg-dim"}>{p}</span>
          </span>
        ))}
      </div>
    );
  }

  // ---- tall panel (idle stage) ---------------------------------------------
  return (
    <div className="flex h-full flex-col justify-center rounded-xl border border-white/[0.07] bg-ink-850/40 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(61,245,196,0.9)]" />
        Your connection
      </div>

      {!meta ? (
        <div className="mt-4 font-mono text-sm text-fg-faint">Detecting…</div>
      ) : (
        <>
          <div className="mt-3 font-mono text-[clamp(1.1rem,2.4vw,1.7rem)] font-medium leading-tight text-fg break-all">
            {meta.ip || "—"}
          </div>
          <div className="mt-1.5 font-mono text-[13px] text-accent-soft">
            {meta.isp || "Unknown ISP"}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.07] pt-3.5">
            {detail(meta, effectiveType).map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-fg-faint">{k}</span>
                <span className="mt-0.5 font-mono text-[13px] text-fg-dim tnum">{v}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export interface Metric {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  /** Override value color (e.g. bufferbloat grade). */
  accent?: string;
  live?: boolean;
}

/**
 * A row of aligned readout cells separated by hairline rules — the data panel of
 * the instrument. Numerics are tabular and the columns line up across cells.
 */
export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 border-t border-white/[0.07] sm:grid-cols-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={[
            "px-4 py-4 sm:px-5 sm:py-5",
            // hairline dividers between cells; no divider on the left edge of each row
            i % 2 !== 0 ? "border-l border-white/[0.07]" : "",
            "sm:border-l sm:[&:nth-child(4n+1)]:border-l-0",
            i >= 2 ? "border-t border-white/[0.07] sm:border-t-0" : "",
          ].join(" ")}
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-faint">
            <span>{m.label}</span>
            {m.live && <span className="h-1 w-1 animate-pulse-ring rounded-full bg-accent" />}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className="font-mono text-[26px] font-medium leading-none tnum"
              style={m.accent ? { color: m.accent } : undefined}
            >
              {m.value}
            </span>
            {m.unit && <span className="font-mono text-[12px] text-fg-faint">{m.unit}</span>}
          </div>
          <div className="mt-1.5 font-mono text-[11px] text-fg-faint tnum">{m.sub ?? " "}</div>
        </div>
      ))}
    </div>
  );
}

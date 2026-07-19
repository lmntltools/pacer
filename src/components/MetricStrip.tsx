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
 * A row of aligned readout cells separated by hairline rules — the spec strip of
 * the instrument. Values are mono + tabular so columns line up across cells.
 */
export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={[
            "px-4 py-4 sm:px-5 sm:py-5",
            // hairline dividers between cells; no divider on the left edge of each row
            i % 2 !== 0 ? "border-l border-line" : "",
            "sm:border-l sm:[&:nth-child(4n+1)]:border-l-0",
            i >= 2 ? "border-t border-line sm:border-t-0" : "",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <span className="eng">{m.label}</span>
            {m.live && <span className="h-1.5 w-1.5 animate-flick rounded-full bg-meter-amber" />}
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span
              className="mono text-[26px] font-medium leading-none tnum text-ink"
              style={m.accent ? { color: m.accent } : undefined}
            >
              {m.value}
            </span>
            {m.unit && <span className="mono text-[12px] text-ink-40">{m.unit}</span>}
          </div>
          <div className="mono mt-2 text-[11px] text-ink-40 tnum">{m.sub ?? " "}</div>
        </div>
      ))}
    </div>
  );
}

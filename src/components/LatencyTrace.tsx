import { formatMs } from "../lib/format";

/**
 * Ping-phase visualization: each idle RTT as a cell, building left-to-right.
 * Keeps the instrument's main pane meaningful while latency is being measured.
 * Colors come from the token layer so it repaints with the theme.
 */
export function LatencyTrace({ pings }: { pings: number[] }) {
  const maxRtt = pings.length ? Math.max(...pings, 1) : 1;
  const sorted = [...pings].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const slots = 20;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-baseline justify-between">
        <span className="eng">Latency sequence</span>
        <span className="mono text-[11px] text-ink-40 tnum">
          {pings.length}/{slots} probes
        </span>
      </div>

      <div className="relative mt-3 flex flex-1 items-end gap-[3px]">
        {/* baseline */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: "var(--line-ctl)" }} />
        {Array.from({ length: slots }).map((_, i) => {
          const rtt = pings[i];
          const h = rtt != null ? Math.max(4, (rtt / maxRtt) * 100) : 0;
          const isLast = i === pings.length - 1;
          return (
            <div key={i} className="flex h-full flex-1 items-end">
              <div
                className="w-full rounded-[1px] transition-[height] duration-200"
                style={{
                  height: `${h}%`,
                  background: rtt == null ? "var(--cell-empty)" : "var(--signal)",
                  opacity: rtt == null ? 1 : isLast ? 1 : 0.55,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-baseline gap-6 border-t border-line pt-2.5">
        <span className="flex items-baseline gap-2">
          <span className="eng">median</span>
          <span className="mono text-[11px] text-ink-60 tnum">{formatMs(median)} ms</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="eng">peak</span>
          <span className="mono text-[11px] text-ink-60 tnum">{formatMs(maxRtt)} ms</span>
        </span>
      </div>
    </div>
  );
}

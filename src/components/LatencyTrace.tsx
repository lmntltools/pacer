import { formatMs } from "../lib/format";

/**
 * Ping-phase visualization: each idle RTT as a bar, building left-to-right.
 * Keeps the instrument's main pane meaningful while latency is being measured.
 */
export function LatencyTrace({ pings, color }: { pings: number[]; color: string }) {
  const maxRtt = pings.length ? Math.max(...pings, 1) : 1;
  const sorted = [...pings].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const slots = 20;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <span>Latency sequence</span>
        <span className="tnum">{pings.length}/{slots} probes</span>
      </div>

      <div className="relative mt-3 flex flex-1 items-end gap-[3px]">
        {/* baseline */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/10" />
        {Array.from({ length: slots }).map((_, i) => {
          const rtt = pings[i];
          const h = rtt != null ? Math.max(4, (rtt / maxRtt) * 100) : 0;
          const isLast = i === pings.length - 1;
          return (
            <div key={i} className="flex h-full flex-1 items-end">
              <div
                className="w-full rounded-[2px] transition-[height] duration-200"
                style={{
                  height: `${h}%`,
                  background: rtt == null ? "rgba(255,255,255,0.04)" : color,
                  opacity: rtt == null ? 1 : isLast ? 1 : 0.5,
                  boxShadow: isLast && rtt != null ? `0 0 10px ${color}` : "none",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-baseline gap-5 border-t border-white/[0.07] pt-2.5 font-mono text-[11px]">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-fg-faint">median</span>
          <span className="text-fg-dim tnum">{formatMs(median)} ms</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-fg-faint">peak</span>
          <span className="text-fg-dim tnum">{formatMs(maxRtt)} ms</span>
        </span>
      </div>
    </div>
  );
}

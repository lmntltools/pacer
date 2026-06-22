import type { Unit } from "../engine/types";
import type { UseSpeedTest } from "../hooks/useSpeedTest";
import { formatMs, formatSpeed, unitLabel } from "../lib/format";

type Tone = "idle" | "live" | "done";

function Readout({
  dir,
  label,
  value,
  unit,
  size,
  tone,
}: {
  dir?: "down" | "up";
  label: string;
  value: string;
  unit: string;
  size: "giant" | "big";
  tone: Tone;
}) {
  const valueColor = tone === "idle" ? "text-fg-faint" : tone === "done" ? "text-fg" : "text-fg";
  const valueSize =
    size === "giant"
      ? "text-[clamp(4rem,13vw,8.5rem)]"
      : "text-[clamp(2.2rem,6.5vw,3.6rem)]";
  const arrow = dir === "down" ? "↓" : dir === "up" ? "↑" : "";
  return (
    <div>
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]">
        {arrow && <span className="text-accent">{arrow}</span>}
        <span className={tone === "live" ? "text-accent" : "text-fg-dim"}>{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2.5">
        <span
          className={[
            "font-mono font-bold leading-[0.82] tracking-[-0.045em] tnum",
            valueSize,
            valueColor,
            tone === "live" ? "[text-shadow:0_0_30px_rgba(61,245,196,0.25)]" : "",
          ].join(" ")}
        >
          {value}
        </span>
        <span className="font-mono text-[clamp(0.85rem,1.6vw,1.15rem)] text-fg-faint">{unit}</span>
      </div>
    </div>
  );
}

export function Hero({ st, unit }: { st: UseSpeedTest; unit: Unit }) {
  // ---- results: download (giant) + upload (big), stacked & aligned ----------
  if (st.status === "done") {
    return (
      <div className="flex flex-col gap-7">
        <Readout
          dir="down"
          label="Download"
          value={formatSpeed(st.downloadMbps, unit)}
          unit={unitLabel(unit)}
          size="giant"
          tone="done"
        />
        <Readout
          dir="up"
          label="Upload"
          value={formatSpeed(st.uploadMbps, unit)}
          unit={unitLabel(unit)}
          size="big"
          tone="done"
        />
      </div>
    );
  }

  // ---- error ----------------------------------------------------------------
  if (st.status === "error") {
    return (
      <Readout dir={undefined} label="Error" value="—" unit="" size="giant" tone="idle" />
    );
  }

  // ---- idle -----------------------------------------------------------------
  if (st.status === "idle") {
    return (
      <div>
        <Readout label="Ready" value="0" unit={unitLabel(unit)} size="giant" tone="idle" />
        <p className="mt-5 max-w-sm font-mono text-[12px] leading-relaxed text-fg-faint">
          Real throughput over parallel streams. Real latency from time-to-first-byte.
          No fabricated numbers.
        </p>
      </div>
    );
  }

  // ---- running --------------------------------------------------------------
  if (st.phase === "meta") {
    return <Readout label="Connecting" value="—" unit="" size="giant" tone="live" />;
  }
  if (st.phase === "ping") {
    return (
      <div>
        <Readout label="Ping" value={formatMs(st.live.pingMs)} unit="ms" size="giant" tone="live" />
        <SubLine items={[["jitter", `${formatMs(st.live.jitterMs)} ms`]]} />
      </div>
    );
  }
  // download / upload
  const isUp = st.phase === "upload";
  return (
    <div>
      <Readout
        dir={isUp ? "up" : "down"}
        label={isUp ? "Upload" : "Download"}
        value={formatSpeed(st.live.mbps, unit)}
        unit={unitLabel(unit)}
        size="giant"
        tone="live"
      />
      <SubLine
        items={
          isUp
            ? [
                ["download", `${formatSpeed(st.downloadMbps, unit)} ${unitLabel(unit)}`],
                ["ping", `${formatMs(st.live.pingMs)} ms`],
              ]
            : [["ping", `${formatMs(st.live.pingMs)} ms`], ["loaded", `${formatMs(st.live.loadedMs)} ms`]]
        }
      />
    </div>
  );
}

function SubLine({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[12px]">
      {items.map(([k, v]) => (
        <span key={k} className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-fg-faint">{k}</span>
          <span className="text-fg-dim tnum">{v}</span>
        </span>
      ))}
    </div>
  );
}

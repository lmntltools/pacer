import type { Unit } from "../engine/types";
import type { UseSpeedTest } from "../hooks/useSpeedTest";
import { formatMs, formatSpeed, unitLabel } from "../lib/format";
import { DownIcon, UpIcon } from "./icons";

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
  const valueColor = tone === "idle" ? "text-ink-40" : "text-ink";
  const valueSize =
    size === "giant"
      ? "text-[clamp(3.6rem,12vw,7.5rem)]"
      : "text-[clamp(2rem,6vw,3.4rem)]";
  const Arrow = dir === "down" ? DownIcon : dir === "up" ? UpIcon : null;
  return (
    <div>
      <div className="flex items-center gap-2">
        {Arrow && <Arrow className="text-[13px] text-signal" />}
        <span className={`eng ${tone === "live" ? "!text-signal-ink" : ""}`}>{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2.5">
        <span
          className={[
            "mono font-medium leading-[0.85] tracking-[-0.03em] tnum",
            valueSize,
            valueColor,
          ].join(" ")}
        >
          {value}
        </span>
        {tone === "live" && <span className="rd-cursor mono text-[clamp(1.6rem,5vw,3rem)] leading-none">_</span>}
        <span className="mono text-[clamp(0.8rem,1.6vw,1.1rem)] text-ink-40">{unit}</span>
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
    return <Readout dir={undefined} label="Error" value="—" unit="" size="giant" tone="idle" />;
  }

  // ---- idle -----------------------------------------------------------------
  if (st.status === "idle") {
    return (
      <div>
        <Readout label="Ready" value="0" unit={unitLabel(unit)} size="giant" tone="idle" />
        <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-ink-60">
          Real throughput over parallel streams. Real latency from time-to-first-byte.{" "}
          <span className="text-ink-40">No fabricated numbers.</span>
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
    <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
      {items.map(([k, v]) => (
        <span key={k} className="flex items-baseline gap-2">
          <span className="eng">{k}</span>
          <span className="mono text-[13px] text-ink-60 tnum">{v}</span>
        </span>
      ))}
    </div>
  );
}

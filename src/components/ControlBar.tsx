import { useState } from "react";
import { APP_NAME } from "../config";
import type { SpeedTestResult, Unit } from "../engine/types";
import type { Status } from "../hooks/useSpeedTest";
import { formatBytes, formatTimestamp } from "../lib/format";
import { buildShareText, copyText } from "../lib/share";
import { CheckIcon, CopyIcon, PlayIcon, RetryIcon, ShareIcon, StopIcon } from "./icons";

// Shared machined-key base for every button in the bar.
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-ctrl border font-sans uppercase " +
  "text-[13px] tracking-[0.04em] transition-[transform,background,border-color,color] " +
  "duration-100 ease-snap active:translate-y-px [font-variation-settings:'wdth'_90,'wght'_680]";

function UnitToggle({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  const opts: { key: Unit; label: string }[] = [
    { key: "mbps", label: "Mbps" },
    { key: "mbytes", label: "MB/s" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Throughput unit"
      className="inline-flex overflow-hidden rounded-ctrl border border-ink"
    >
      {opts.map((o, i) => {
        const active = unit === o.key;
        return (
          <button
            key={o.key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={[
              "mono px-3.5 py-2 text-[12px] transition-colors duration-[90ms] ease-snap",
              i > 0 ? "border-l border-line" : "",
              active ? "bg-ink text-panel" : "bg-panel text-ink-60 hover:text-ink",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PrimaryAction({
  status,
  onStart,
  onCancel,
}: {
  status: Status;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (status === "running") {
    return (
      <button onClick={onCancel} className={`${BTN} border-ink bg-panel px-6 py-3 text-ink`}>
        <StopIcon className="text-[13px]" />
        Stop
      </button>
    );
  }
  if (status === "done" || status === "error") {
    return (
      <button onClick={onStart} className={`${BTN} border-ink bg-panel px-6 py-3 text-ink hover:bg-seat`}>
        <RetryIcon className="text-[13px]" />
        Run again
      </button>
    );
  }
  return (
    <button
      onClick={onStart}
      className={`${BTN} border-signal bg-signal px-8 py-3.5 text-white hover:border-signal-deep hover:bg-signal-deep`}
    >
      <PlayIcon className="text-[14px]" />
      Start test
    </button>
  );
}

function ShareButtons({ result, unit }: { result: SpeedTestResult; unit: Unit }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const doCopy = async () => {
    if (await copyText(buildShareText(result, unit))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };
  const doShare = async () => {
    try {
      await navigator.share({ title: `${APP_NAME} speed test`, text: buildShareText(result, unit) });
    } catch {
      await doCopy();
    }
  };

  const ghost =
    "inline-flex items-center gap-1.5 rounded-ctrl border border-line px-3 py-2 " +
    "mono text-[11px] text-ink-60 transition-colors hover:border-ink hover:text-ink";

  return (
    <div className="flex items-center gap-2">
      <button onClick={doCopy} className={ghost}>
        {copied ? <CheckIcon className="text-signal-ink" /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </button>
      {canShare && (
        <button onClick={doShare} className={ghost}>
          <ShareIcon />
          Share
        </button>
      )}
    </div>
  );
}

interface Props {
  status: Status;
  result: SpeedTestResult | null;
  unit: Unit;
  onUnitChange: (u: Unit) => void;
  onStart: () => void;
  onCancel: () => void;
}

export function ControlBar({ status, result, unit, onUnitChange, onStart, onCancel }: Props) {
  const transferred = result ? (result.download?.bytes ?? 0) + (result.upload?.bytes ?? 0) : 0;
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <PrimaryAction status={status} onStart={onStart} onCancel={onCancel} />
        {status === "done" && result && (
          <span className="mono hidden text-[11px] text-ink-40 tnum md:inline">
            {formatTimestamp(result.timestamp)} · {formatBytes(transferred)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <UnitToggle unit={unit} onChange={onUnitChange} />
        {status === "done" && result && <ShareButtons result={result} unit={unit} />}
      </div>
    </div>
  );
}

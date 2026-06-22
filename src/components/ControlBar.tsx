import { useState } from "react";
import { APP_NAME } from "../config";
import type { SpeedTestResult, Unit } from "../engine/types";
import type { Status } from "../hooks/useSpeedTest";
import { formatBytes, formatTimestamp } from "../lib/format";
import { buildShareText, copyText } from "../lib/share";
import { CheckIcon, CopyIcon, PlayIcon, RetryIcon, ShareIcon, StopIcon } from "./icons";

function UnitToggle({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  const opts: { key: Unit; label: string }[] = [
    { key: "mbps", label: "Mbps" },
    { key: "mbytes", label: "MB/s" },
  ];
  return (
    <div role="radiogroup" aria-label="Throughput unit" className="inline-flex rounded-md border border-white/10 p-0.5">
      {opts.map((o) => {
        const active = unit === o.key;
        return (
          <button
            key={o.key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={[
              "rounded-[5px] px-3 py-1 font-mono text-[11px] tracking-wide transition-colors",
              active ? "bg-accent/15 text-accent" : "text-fg-faint hover:text-fg-dim",
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
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-2 rounded-md border border-white/12 px-6 py-2.5 text-[14px] font-medium text-fg-dim transition-colors hover:border-bad/60 hover:text-bad"
      >
        <StopIcon className="text-[13px]" />
        Stop
      </button>
    );
  }
  if (status === "done" || status === "error") {
    return (
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-6 py-2.5 text-[14px] font-semibold text-accent transition-colors hover:bg-accent/15"
      >
        <RetryIcon className="text-[13px]" />
        Run again
      </button>
    );
  }
  return (
    <button
      onClick={onStart}
      className="inline-flex items-center gap-2.5 rounded-md bg-accent px-8 py-3 text-[15px] font-semibold text-ink-900 shadow-[0_0_34px_-8px_rgba(61,245,196,0.8)] transition-transform hover:scale-[1.02] active:scale-100"
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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={doCopy}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 font-mono text-[11px] text-fg-dim transition-colors hover:border-accent/40 hover:text-accent"
      >
        {copied ? <CheckIcon className="text-accent" /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </button>
      {canShare && (
        <button
          onClick={doShare}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 font-mono text-[11px] text-fg-dim transition-colors hover:border-accent/40 hover:text-accent"
        >
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
  const transferred =
    result ? (result.download?.bytes ?? 0) + (result.upload?.bytes ?? 0) : 0;
  return (
    <div className="flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <PrimaryAction status={status} onStart={onStart} onCancel={onCancel} />
        {status === "done" && result && (
          <span className="hidden font-mono text-[11px] text-fg-faint tnum md:inline">
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

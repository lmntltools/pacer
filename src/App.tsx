import { useState } from "react";
import type { Unit } from "./engine/types";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useSpeedTest } from "./hooks/useSpeedTest";
import type { UseSpeedTest } from "./hooks/useSpeedTest";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ControlBar } from "./components/ControlBar";
import { Hero } from "./components/Hero";
import { LatencyTrace } from "./components/LatencyTrace";
import type { Metric } from "./components/MetricStrip";
import { MetricStrip } from "./components/MetricStrip";
import { Oscilloscope } from "./components/Oscilloscope";
import { PhaseRail } from "./components/PhaseRail";
import { TopBar } from "./components/TopBar";
import { AlertIcon } from "./components/icons";
import { formatMs, formatSpeed, gradeColor, unitLabel } from "./lib/format";

const ACCENT = "#3DF5C4";
const ACCENT_UP = "#2BD3A8";

export default function App() {
  const st = useSpeedTest();
  const reduced = usePrefersReducedMotion();
  const [unit, setUnit] = useState<Unit>("mbps");

  const isTransfer = st.phase === "download" || st.phase === "upload";
  const scopeColor = st.phase === "upload" ? ACCENT_UP : ACCENT;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopBar meta={st.meta} effectiveType={st.effectiveType} />

      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-5 sm:px-8">
          <div className="border-b border-white/[0.07] py-5 sm:py-6">
            <PhaseRail phase={st.phase} />
          </div>

          {/* instrument: hero readout + live scope */}
          <div className="grid flex-1 grid-cols-1 items-center gap-9 py-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-14 lg:py-12">
            <Hero st={st} unit={unit} />
            <div className="h-[210px] sm:h-[260px] lg:h-[300px]">
              <Stage st={st} unit={unit} color={scopeColor} reduced={reduced} isTransfer={isTransfer} />
            </div>
          </div>

          <MetricStrip metrics={metricsFor(st, unit)} />

          {(st.status === "running" || st.status === "done") && (
            <ConnectionPanel meta={st.meta} effectiveType={st.effectiveType} variant="bar" />
          )}

          <div className="py-5 sm:py-6">
            <ControlBar
              status={st.status}
              result={st.result}
              unit={unit}
              onUnitChange={setUnit}
              onStart={st.start}
              onCancel={st.cancel}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.07]">
        <p className="mx-auto max-w-[1200px] px-5 py-4 text-center font-mono text-[10px] leading-relaxed tracking-wide text-fg-faint sm:px-8">
          5 parallel streams, summed · TCP slow-start discarded · 90th-percentile bandwidth ·
          TTFB ping · jitter = mean consecutive RTT delta
        </p>
      </footer>

      <p className="sr-only" aria-live="polite">
        {statusMessage(st, unit)}
      </p>
    </div>
  );
}

function Stage({
  st,
  unit,
  color,
  reduced,
  isTransfer,
}: {
  st: UseSpeedTest;
  unit: Unit;
  color: string;
  reduced: boolean;
  isTransfer: boolean;
}) {
  if (st.status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 border border-bad/30 bg-bad/[0.04] text-center">
        <AlertIcon className="text-2xl text-bad" />
        <div className="text-sm font-medium text-fg">Test failed</div>
        <div className="max-w-xs font-mono text-[11px] text-fg-dim">
          {st.error ?? "Could not reach the test server."}
        </div>
      </div>
    );
  }
  if (isTransfer || st.status === "done") {
    return (
      <Oscilloscope
        samples={st.chart}
        unit={unit}
        color={color}
        reducedMotion={reduced}
        active={st.status === "running"}
      />
    );
  }
  if (st.phase === "ping") {
    return <LatencyTrace pings={st.pings} color={ACCENT} />;
  }
  // idle / meta — show the detected connection where the scope rests
  return <ConnectionPanel meta={st.meta} effectiveType={st.effectiveType} variant="panel" />;
}

function metricsFor(st: UseSpeedTest, unit: Unit): Metric[] {
  if (st.status === "done" && st.result) {
    const r = st.result;
    const loadedWorst =
      r.loadedLatency.download !== null || r.loadedLatency.upload !== null
        ? Math.max(r.loadedLatency.download ?? 0, r.loadedLatency.upload ?? 0)
        : null;
    return [
      { label: "Ping", value: formatMs(r.latency?.median), unit: "ms", sub: `min ${formatMs(r.latency?.min)} ms` },
      { label: "Jitter", value: formatMs(r.latency?.jitter), unit: "ms", sub: "consecutive Δ" },
      {
        label: "Loaded latency",
        value: formatMs(loadedWorst),
        unit: "ms",
        sub: `↓ ${formatMs(r.loadedLatency.download)} · ↑ ${formatMs(r.loadedLatency.upload)}`,
      },
      {
        label: "Bufferbloat",
        value: r.bufferbloat.worst !== null ? `+${formatMs(r.bufferbloat.worst)}` : "—",
        unit: r.bufferbloat.worst !== null ? "ms" : "",
        sub: r.bufferbloat.grade ? `grade ${r.bufferbloat.grade}` : "—",
        accent: gradeColor(r.bufferbloat.grade),
      },
    ];
  }

  if (st.status === "running") {
    const transfer = st.phase === "download" || st.phase === "upload";
    return [
      { label: "Ping", value: formatMs(st.live.pingMs), unit: "ms", sub: "time-to-first-byte", live: st.phase === "ping" },
      { label: "Jitter", value: formatMs(st.live.jitterMs), unit: "ms", sub: "consecutive Δ" },
      { label: "Loaded latency", value: formatMs(st.live.loadedMs), unit: "ms", sub: "under load", live: transfer },
      {
        label: transfer && st.phase === "upload" ? "Download" : "Bufferbloat",
        value:
          transfer && st.phase === "upload"
            ? formatSpeed(st.downloadMbps, unit)
            : "—",
        unit: transfer && st.phase === "upload" ? unitLabel(unit) : "",
        sub: transfer && st.phase === "upload" ? "result" : "measuring",
      },
    ];
  }

  // idle / error — a spec sheet that doubles as a plain-language methodology note
  return [
    { label: "Streams", value: "5", sub: "parallel, summed" },
    { label: "Warm-up", value: "1.2", unit: "s", sub: "slow-start cut" },
    { label: "Bandwidth", value: "p90", sub: "of throughput" },
    { label: "Ping", value: "TTFB", sub: "responseStart" },
  ];
}

function statusMessage(st: UseSpeedTest, unit: Unit): string {
  if (st.status === "idle") return "Ready to test.";
  if (st.status === "error") return `Test failed: ${st.error ?? "network error"}`;
  if (st.status === "done" && st.result) {
    return `Done. Download ${formatSpeed(st.downloadMbps, unit)} ${unitLabel(unit)}, upload ${formatSpeed(
      st.uploadMbps,
      unit,
    )} ${unitLabel(unit)}, ping ${formatMs(st.result.latency?.median)} milliseconds.`;
  }
  if (st.phase === "ping") return `Measuring ping: ${formatMs(st.live.pingMs)} milliseconds.`;
  if (st.phase === "download") return `Measuring download: ${formatSpeed(st.live.mbps, unit)} ${unitLabel(unit)}.`;
  if (st.phase === "upload") return `Measuring upload: ${formatSpeed(st.live.mbps, unit)} ${unitLabel(unit)}.`;
  return "Connecting to the test server.";
}

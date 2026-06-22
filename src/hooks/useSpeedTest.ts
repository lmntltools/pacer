import { useCallback, useEffect, useRef, useState } from "react";
import { WORKER_BASE_URL } from "../config";
import { SpeedTestEngine } from "../engine/speedtest";
import type {
  MetaInfo,
  Phase,
  SpeedTestResult,
  ThroughputSample,
} from "../engine/types";

export type Status = "idle" | "running" | "done" | "error";

export interface LiveValues {
  /** Current-phase instantaneous throughput, Mbps. */
  mbps: number;
  /** Latest idle ping RTT, ms. */
  pingMs: number | null;
  /** Running jitter estimate, ms. */
  jitterMs: number | null;
  /** Latest loaded-latency RTT, ms. */
  loadedMs: number | null;
  /** 0..1 progress within the current phase. */
  progress: number;
}

export interface SpeedTestState {
  status: Status;
  phase: Phase;
  meta: MetaInfo | null;
  /** Public IPv4, fetched from an IPv4-only echo (the Worker often sees IPv6). */
  ipv4: string | null;
  effectiveType: string | null;
  live: LiveValues;
  /** Live-updating, frozen on phase change, finalized (to p90) on completion. */
  downloadMbps: number | null;
  uploadMbps: number | null;
  /** Samples for the current transfer phase, fed to the live chart. */
  chart: ThroughputSample[];
  /** Idle-ping RTTs accumulated during the ping phase, for the latency trace. */
  pings: number[];
  result: SpeedTestResult | null;
  error: string | null;
}

const INITIAL: SpeedTestState = {
  status: "idle",
  phase: "idle",
  meta: null,
  ipv4: null,
  effectiveType: null,
  live: { mbps: 0, pingMs: null, jitterMs: null, loadedMs: null, progress: 0 },
  downloadMbps: null,
  uploadMbps: null,
  chart: [],
  pings: [],
  result: null,
  error: null,
};

function readEffectiveType(): string | null {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return c?.effectiveType ?? null;
}

export interface UseSpeedTest extends SpeedTestState {
  start: () => void;
  cancel: () => void;
  reset: () => void;
}

/** React binding around the standalone engine. Owns all UI-facing state. */
export function useSpeedTest(): UseSpeedTest {
  const [state, setState] = useState<SpeedTestState>(INITIAL);
  const engineRef = useRef<SpeedTestEngine | null>(null);

  const start = useCallback(() => {
    engineRef.current?.cancel();
    setState((s) => ({
      ...INITIAL,
      status: "running",
      phase: "meta",
      effectiveType: readEffectiveType(),
      meta: s.meta, // keep the connection info we already fetched at idle
      ipv4: s.ipv4,
    }));

    const engine = new SpeedTestEngine(
      { baseUrl: WORKER_BASE_URL },
      {
        onPhaseChange: (phase) =>
          setState((s) => {
            const entersTransfer = phase === "download" || phase === "upload";
            return {
              ...s,
              phase,
              // Reset the chart at the start of each transfer phase so download
              // and upload draw on their own clean canvas.
              chart: entersTransfer ? [] : s.chart,
              live: { ...s.live, mbps: 0, progress: 0 },
            };
          }),
        onMeta: (meta) => setState((s) => ({ ...s, meta })),
        onProgress: (e) =>
          setState((s) => {
            const live: LiveValues = { ...s.live };
            if (e.pingMs != null) live.pingMs = e.pingMs;
            if (e.jitterMs != null) live.jitterMs = e.jitterMs;
            if (e.loadedLatencyMs != null) live.loadedMs = e.loadedLatencyMs;
            if (e.progress != null) live.progress = e.progress;
            if (e.mbps != null) live.mbps = e.mbps;

            // Accumulate idle pings during the ping phase for the latency trace.
            const pings =
              e.phase === "ping" && e.pingMs != null ? [...s.pings, e.pingMs] : s.pings;

            let chart = s.chart;
            let downloadMbps = s.downloadMbps;
            let uploadMbps = s.uploadMbps;
            if (e.sample) {
              chart = [...s.chart, e.sample];
              if (e.phase === "download") downloadMbps = e.mbps ?? downloadMbps;
              if (e.phase === "upload") uploadMbps = e.mbps ?? uploadMbps;
            }
            return { ...s, live, pings, chart, downloadMbps, uploadMbps };
          }),
        onComplete: (result) =>
          setState((s) => ({
            ...s,
            status: "done",
            phase: "done",
            result,
            meta: result.meta ?? s.meta,
            effectiveType: result.effectiveType ?? s.effectiveType,
            downloadMbps: result.download?.mbps ?? s.downloadMbps,
            uploadMbps: result.upload?.mbps ?? s.uploadMbps,
          })),
        onError: (err) =>
          setState((s) => ({ ...s, status: "error", phase: "error", error: err.message })),
      },
    );
    engineRef.current = engine;
    void engine.start();
  }, []);

  const cancel = useCallback(() => {
    engineRef.current?.cancel();
    engineRef.current = null;
    setState((s) => ({ ...INITIAL, meta: s.meta, ipv4: s.ipv4, effectiveType: s.effectiveType }));
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.cancel();
    engineRef.current = null;
    setState((s) => ({ ...INITIAL, meta: s.meta, ipv4: s.ipv4, effectiveType: s.effectiveType }));
  }, []);

  // Fetch connection info once on mount so the telemetry HUD is populated at idle,
  // before the user runs anything.
  useEffect(() => {
    let alive = true;
    fetch(`${WORKER_BASE_URL}/meta?cb=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setState((s) =>
          s.meta
            ? s
            : {
                ...s,
                meta: {
                  ip: j.ip ?? "",
                  isp: j.isp ?? "",
                  asn: typeof j.asn === "number" ? j.asn : null,
                  colo: j.colo ?? "",
                  country: j.country ?? "",
                },
                effectiveType: s.effectiveType ?? readEffectiveType(),
              },
        );
      })
      .catch(() => {});

    // The Worker reports whichever IP the browser connected with — on a dual-stack
    // network that's usually IPv6. To also show the familiar IPv4 dotted-quad, ask
    // an IPv4-only echo (forces an IPv4 connection). This is the one external call
    // in the app; all speed MEASUREMENT stays first-party.
    fetch("https://api4.ipify.org?format=json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ip) setState((s) => ({ ...s, ipv4: j.ip as string }));
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  // Abort any in-flight run if the component unmounts.
  useEffect(() => {
    return () => engineRef.current?.cancel();
  }, []);

  return { ...state, start, cancel, reset };
}

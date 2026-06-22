/** Lifecycle phases the engine moves through, in order. */
export type Phase =
  | "idle"
  | "meta"
  | "ping"
  | "download"
  | "upload"
  | "done"
  | "aborted"
  | "error";

/** Throughput unit for display. The engine always computes in Mbps internally. */
export type Unit = "mbps" | "mbytes";

/** Connection info from the Worker's /meta route (Cloudflare-sourced). */
export interface MetaInfo {
  ip: string;
  isp: string;
  asn: number | null;
  colo: string;
  country: string;
}

/** One instantaneous throughput reading during a transfer phase. */
export interface ThroughputSample {
  /** Milliseconds since the phase started. */
  t: number;
  /** Aggregate throughput across all parallel streams, in Mbps. */
  mbps: number;
  /** Cumulative bytes transferred (all streams) at this sample — used for
   *  sliding-window rate computation, which is robust to XHR upload jitter. */
  bytes: number;
}

/** Result of a download or upload phase. */
export interface PhaseResult {
  /** Representative speed: the 90th percentile of post-warmup samples, in Mbps. */
  mbps: number;
  /** Mean of post-warmup samples, in Mbps (for reference / sanity-checking). */
  meanMbps: number;
  /** Peak single sample, in Mbps. */
  peakMbps: number;
  /** All samples captured during the phase (including warmup), for charting. */
  samples: ThroughputSample[];
  /** Total bytes transferred across all streams. */
  bytes: number;
  /** Wall-clock duration of the phase, in milliseconds. */
  durationMs: number;
}

/** Latency statistics from the idle ping phase. */
export interface LatencyResult {
  /** Fastest round trip, in ms. */
  min: number;
  /** Median round trip, in ms. */
  median: number;
  /** Mean absolute difference between consecutive RTTs, in ms. */
  jitter: number;
  /** Raw RTT samples, in ms. */
  samples: number[];
}

/** Latency measured WHILE a transfer is saturating the link. */
export interface LoadedLatency {
  /** Median loaded RTT during download, in ms (null if not captured). */
  download: number | null;
  /** Median loaded RTT during upload, in ms (null if not captured). */
  upload: number | null;
}

/** Bufferbloat = how much latency grew under load vs idle. */
export interface Bufferbloat {
  /** Loaded(download) median minus idle median, in ms. */
  download: number | null;
  /** Loaded(upload) median minus idle median, in ms. */
  upload: number | null;
  /** Worst of the two deltas, in ms. */
  worst: number | null;
  /** Letter grade derived from `worst` (A best … F worst). */
  grade: "A" | "B" | "C" | "D" | "F" | null;
}

/** The full typed result object handed to onComplete. */
export interface SpeedTestResult {
  latency: LatencyResult | null;
  download: PhaseResult | null;
  upload: PhaseResult | null;
  loadedLatency: LoadedLatency;
  bufferbloat: Bufferbloat;
  meta: MetaInfo | null;
  /** navigator.connection.effectiveType if exposed by the browser. */
  effectiveType: string | null;
  /** Unix ms when the run completed. */
  timestamp: number;
}

/** Live progress payload, emitted many times per second during transfers. */
export interface ProgressEvent {
  phase: Phase;
  /** Current aggregate throughput, in Mbps (transfer phases only). */
  mbps?: number;
  /** A newly captured throughput sample (transfer phases only). */
  sample?: ThroughputSample;
  /** 0..1 progress within the current phase (time- or byte-based). */
  progress?: number;
  /** Latest idle ping RTT, in ms (ping phase). */
  pingMs?: number;
  /** Running jitter estimate, in ms (ping phase). */
  jitterMs?: number;
  /** Latest loaded-latency RTT, in ms (transfer phases). */
  loadedLatencyMs?: number;
}

export interface EngineCallbacks {
  onPhaseChange?: (phase: Phase) => void;
  onProgress?: (event: ProgressEvent) => void;
  /** Fired once, early, as soon as /meta resolves — so the UI can show it live. */
  onMeta?: (meta: MetaInfo | null) => void;
  onComplete?: (result: SpeedTestResult) => void;
  onError?: (error: Error) => void;
}

/** Tunable knobs. Sensible defaults are applied in the engine. */
export interface EngineOptions {
  baseUrl: string;
  /** Number of concurrent streams per transfer phase. Default 5. */
  parallelStreams?: number;
  /** How many idle pings to send. Default 20. */
  pingCount?: number;
  /** Warmup window discarded from each transfer phase, in ms. Default 1200. */
  warmupMs?: number;
  /** Max wall-clock per transfer phase, in ms. Default 13000. */
  maxPhaseMs?: number;
  /** Max bytes per transfer phase across all streams. Default 100 MB. */
  maxBytesPerPhase?: number;
  /** Throughput sampling interval, in ms. Default 100. */
  sampleIntervalMs?: number;
}

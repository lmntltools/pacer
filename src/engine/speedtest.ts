/**
 * Pacer measurement engine — standalone, framework-agnostic.
 *
 * This module knows nothing about React. It exposes one class, `SpeedTestEngine`,
 * with `start()` and `cancel()`, and reports everything through callbacks. You
 * could drop it into any frontend (or a Node script with fetch + XHR shims).
 *
 * Methodology, in brief (the details that separate a real test from a toy):
 *
 *   Ping    ~20 sequential GET /down?bytes=0. RTT is taken from
 *           PerformanceResourceTiming (responseStart − requestStart = TTFB) when
 *           the browser exposes it (the Worker sends Timing-Allow-Origin: *),
 *           else from a performance.now() delta around an empty response.
 *           Jitter = mean |RTTᵢ − RTTᵢ₋₁|.
 *
 *   Down    4–6 PARALLEL fetch() streams, read chunk-by-chunk via getReader().
 *           A single TCP connection can't saturate a fast link, so we open
 *           several and SUM their byte rates. The first `warmupMs` of samples are
 *           discarded to skip TCP slow-start. Request size ramps adaptively to
 *           keep each request ~1.5 s long. The reported number is the 90th
 *           percentile of the post-warmup instantaneous-throughput samples.
 *
 *   Up      Same shape, but with XMLHttpRequest (fetch can't report upload
 *           progress) and crypto-random, incompressible payloads — never zeros,
 *           which a CDN could compress into a fake-fast result.
 *
 *   Loaded  During each transfer we keep pinging; the median loaded RTT minus the
 *   latency idle median is the bufferbloat figure.
 *
 * All durations come from performance.now() (monotonic). Date.now() is used in
 * exactly one place — the human-readable "when did this run" timestamp — because
 * that legitimately wants wall-clock time, not elapsed time.
 */

import {
  bufferbloatGrade,
  bytesToMbps,
  jitter,
  max,
  mean,
  median,
  min,
  percentile,
  windowsAgree,
} from "./stats";
import type {
  Bufferbloat,
  EngineCallbacks,
  EngineOptions,
  LatencyResult,
  LoadedLatency,
  MetaInfo,
  Phase,
  PhaseResult,
  ProgressEvent,
  SpeedTestResult,
  ThroughputSample,
} from "./types";

// ----- size / timing constants -------------------------------------------------
const MB = 1024 * 1024;
const DL_START_CHUNK = 1 * MB;
const DL_MIN_CHUNK = 256 * 1024;
const DL_MAX_CHUNK = 32 * MB;
const UL_POOL_MAX = 16 * MB;
const UL_START_CHUNK = 512 * 1024;
const UL_MIN_CHUNK = 128 * 1024;
const ADAPT_TARGET_S = 1.5; // aim each request to last ~1.5s
// Adaptive stop: transfer until the rate PLATEAUS rather than for a fixed byte
// budget. A fast link needs a few seconds to ramp past TCP slow-start; a fixed
// 100 MB budget can end that ramp early and under-report. We keep going until a
// recent 2 s window agrees with the prior 2 s window (within tolerance), then
// stop — so fast links fully ramp, but we don't keep burning data once the
// number is stable. The time and (raised) byte caps remain as hard ceilings.
const STABLE_WINDOW_MS = 2000; // compare the last 2 s against the prior 2 s
const STABLE_MIN_MS = 2 * STABLE_WINDOW_MS; // need two full windows past warmup
const STABLE_TOL = 0.04; // windows within 4% ⇒ plateaued
// Desync the parallel streams so their request boundaries never all line up —
// otherwise every stream can finish its request at the same instant, leaving a
// brief moment where the whole link goes idle (a visible dip to 0 on the chart,
// and a slightly low mean). We stagger their starts and give each a different
// target request duration so the boundaries stay spread across the run.
const STREAM_STAGGER_MS = 140;
const LOADED_PING_INTERVAL_MS = 350;
const PING_TIMEOUT_MS = 5000;

const DEFAULTS: Required<Omit<EngineOptions, "baseUrl">> = {
  parallelStreams: 5,
  pingCount: 20,
  warmupMs: 1200,
  maxPhaseMs: 15000,
  // Safety ceiling only — the adaptive plateau-stop (and the time cap) normally
  // end a phase well before this. Raised from 100 MB so a fast link isn't cut
  // off mid-ramp; the time cap still bounds worst-case data (~1.5 GB at ~0.9 Gbps).
  maxBytesPerPhase: 1500 * MB,
  sampleIntervalMs: 100,
};

// ----- tiny helpers ------------------------------------------------------------
class AbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}
function isAbort(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { name?: string }).name === "AbortError";
}
/** Cache-busting token so no proxy/browser cache can serve a stale response. */
function cb(): string {
  return Math.random().toString(36).slice(2) + performance.now().toString(36);
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function perfEntry(url: string): PerformanceResourceTiming | undefined {
  const entries = performance.getEntriesByName(url) as PerformanceResourceTiming[];
  return entries.length ? entries[entries.length - 1] : undefined;
}
function getEffectiveType(): string | null {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return c?.effectiveType ?? null;
}

export class SpeedTestEngine {
  private readonly opts: Required<EngineOptions>;
  private readonly callbacks: EngineCallbacks;
  /** Top-level cancel signal; aborting this aborts the whole run. */
  private readonly controller = new AbortController();
  private readonly activeXhrs = new Set<XMLHttpRequest>();
  private uploadPool: Uint8Array<ArrayBuffer> | null = null;
  private idleMedian = 0;
  private readonly loaded: LoadedLatency = { download: null, upload: null };

  constructor(options: EngineOptions, callbacks: EngineCallbacks = {}) {
    this.opts = { ...DEFAULTS, ...options, baseUrl: options.baseUrl.replace(/\/$/, "") };
    this.callbacks = callbacks;
  }

  /** Abort an in-flight run. Safe to call at any time. */
  cancel(): void {
    this.controller.abort();
    for (const xhr of this.activeXhrs) xhr.abort();
    this.activeXhrs.clear();
  }

  private setPhase(p: Phase): void {
    this.callbacks.onPhaseChange?.(p);
  }
  private emit(e: ProgressEvent): void {
    this.callbacks.onProgress?.(e);
  }
  private get aborted(): boolean {
    return this.controller.signal.aborted;
  }

  /** Run the full test. Resolves with the result, or null if cancelled. */
  async start(): Promise<SpeedTestResult | null> {
    try {
      // Generous Resource Timing buffer so loaded-latency pings can read their
      // own TTFB even while a fast download fires hundreds of requests.
      performance.setResourceTimingBufferSize?.(5000);

      this.setPhase("meta");
      const meta = await this.fetchMeta();
      this.callbacks.onMeta?.(meta);

      this.setPhase("ping");
      const latency = await this.runPing();
      this.idleMedian = latency.median;

      this.setPhase("download");
      const download = await this.runTransfer("download");

      this.setPhase("upload");
      const upload = await this.runTransfer("upload");

      const bufferbloat = this.computeBufferbloat();
      const result: SpeedTestResult = {
        latency,
        download,
        upload,
        loadedLatency: this.loaded,
        bufferbloat,
        meta,
        effectiveType: getEffectiveType(),
        timestamp: Date.now(), // wall-clock "when", not a measurement
      };
      this.setPhase("done");
      this.callbacks.onComplete?.(result);
      return result;
    } catch (e) {
      if (isAbort(e) || this.aborted) {
        this.setPhase("aborted");
        return null;
      }
      this.setPhase("error");
      this.callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }

  // ----- /meta ----------------------------------------------------------------
  private async fetchMeta(): Promise<MetaInfo | null> {
    try {
      const resp = await fetch(`${this.opts.baseUrl}/meta?cb=${cb()}`, {
        cache: "no-store",
        signal: this.controller.signal,
      });
      if (!resp.ok) return null;
      const j = (await resp.json()) as Partial<MetaInfo>;
      return {
        ip: j.ip ?? "",
        isp: j.isp ?? "",
        asn: typeof j.asn === "number" ? j.asn : null,
        colo: j.colo ?? "",
        country: j.country ?? "",
      };
    } catch {
      return null; // meta is informational; never fail the whole test over it
    }
  }

  // ----- ping -----------------------------------------------------------------
  /** A single RTT probe: prefers TTFB from Resource Timing, falls back to wall delta. */
  private async pingOnce(parent: AbortSignal): Promise<number> {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);

    const url = `${this.opts.baseUrl}/down?bytes=0&cb=${cb()}`;
    const t0 = performance.now();
    try {
      const resp = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      await resp.arrayBuffer(); // body is empty, so this resolves right after headers
      const t1 = performance.now();
      const entry = perfEntry(url);
      // responseStart − requestStart = time to first byte, excluding connect.
      // These are non-zero only because the Worker sends Timing-Allow-Origin: *.
      if (
        entry &&
        entry.responseStart > 0 &&
        entry.requestStart > 0 &&
        entry.responseStart >= entry.requestStart
      ) {
        return entry.responseStart - entry.requestStart;
      }
      return t1 - t0; // fallback RTT: full round-trip of an empty response
    } finally {
      clearTimeout(timer);
      parent.removeEventListener("abort", onAbort);
    }
  }

  private async runPing(): Promise<LatencyResult> {
    const rtts: number[] = [];
    // One throwaway probe to open the connection so the first timed sample
    // isn't polluted by DNS/TLS setup.
    try {
      await this.pingOnce(this.controller.signal);
    } catch (e) {
      if (this.aborted) throw e;
    }
    for (let i = 0; i < this.opts.pingCount; i++) {
      if (this.aborted) throw new AbortError();
      try {
        const rtt = await this.pingOnce(this.controller.signal);
        rtts.push(rtt);
        this.emit({
          phase: "ping",
          pingMs: rtt,
          jitterMs: jitter(rtts),
          progress: (i + 1) / this.opts.pingCount,
        });
      } catch (e) {
        if (this.aborted) throw e;
        // transient single-ping failure: skip it and keep going
      }
    }
    if (rtts.length === 0) {
      throw new Error("Ping failed — no response from the test server.");
    }
    return {
      min: min(rtts),
      median: median(rtts),
      jitter: jitter(rtts),
      samples: rtts,
    };
  }

  // ----- download / upload (shared orchestration) -----------------------------
  private async runTransfer(kind: "download" | "upload"): Promise<PhaseResult> {
    const { warmupMs, maxPhaseMs, maxBytesPerPhase, sampleIntervalMs, parallelStreams } = this.opts;

    // `phaseCtrl` ends the phase — for ANY reason: time cap, byte cap, or user
    // cancel. We forward the top-level cancel into it so a user Cancel also stops
    // this phase; we tell the two apart afterwards by checking `this.aborted`.
    const phaseCtrl = new AbortController();
    const forwardCancel = () => phaseCtrl.abort();
    if (this.aborted) phaseCtrl.abort();
    else this.controller.signal.addEventListener("abort", forwardCancel, { once: true });

    const counter = { bytes: 0 }; // shared byte total across all parallel streams
    const samples: ThroughputSample[] = [];
    const loadedPings: number[] = [];
    const phaseStart = performance.now();
    let lastT = 0;
    const SMOOTH_WINDOW = 600; // ms — trailing window for the displayed/charted rate

    // Hard time cap.
    const capTimer = setTimeout(() => phaseCtrl.abort(), maxPhaseMs);

    // Sampler: every sampleIntervalMs, emit a throughput reading. We report the
    // rate over a short TRAILING WINDOW (not the last 100 ms) so the live number
    // and the chart are smooth — crucial for upload, where XHR progress events
    // arrive in bursts and a raw 100 ms delta swings between a spike and zero.
    const sampleTimer = setInterval(() => {
      const now = performance.now() - phaseStart;
      if (now <= lastT) return;
      lastT = now;
      const curBytes = counter.bytes;
      // baseline = most recent sample at least SMOOTH_WINDOW ago, else phase start
      let baseT = 0;
      let baseBytes = 0;
      for (let k = samples.length - 1; k >= 0; k--) {
        if (now - samples[k].t >= SMOOTH_WINDOW) {
          baseT = samples[k].t;
          baseBytes = samples[k].bytes;
          break;
        }
      }
      const dt = now - baseT;
      const mbps = dt > 0 ? bytesToMbps(curBytes - baseBytes, dt) : 0;
      const sample: ThroughputSample = { t: now, mbps, bytes: curBytes };
      samples.push(sample);
      this.emit({
        phase: kind,
        mbps,
        sample,
        progress: clamp(Math.max(now / maxPhaseMs, curBytes / maxBytesPerPhase), 0, 1),
      });
      if (curBytes >= maxBytesPerPhase) phaseCtrl.abort(); // safety byte ceiling
      // Adaptive stop: once we have two full windows past warmup and the rate has
      // plateaued, end the phase — the link has ramped and further transfer just
      // burns data without changing the number.
      if (now >= warmupMs + STABLE_MIN_MS) {
        const recent: number[] = [];
        const prior: number[] = [];
        for (const s of samples) {
          if (s.t < warmupMs) continue;
          if (s.t >= now - STABLE_WINDOW_MS) recent.push(s.mbps);
          else if (s.t >= now - 2 * STABLE_WINDOW_MS) prior.push(s.mbps);
        }
        if (windowsAgree(recent, prior, STABLE_TOL)) phaseCtrl.abort();
      }
    }, sampleIntervalMs);

    // Loaded-latency pinger: measures RTT while the link is saturated.
    const pingTimer = setInterval(() => {
      if (phaseCtrl.signal.aborted) return;
      this.pingOnce(phaseCtrl.signal)
        .then((rtt) => {
          loadedPings.push(rtt);
          this.emit({ phase: kind, loadedLatencyMs: rtt });
        })
        .catch(() => {
          /* ignore individual loaded-ping failures */
        });
    }, LOADED_PING_INTERVAL_MS);

    // Smoothed current speed for adaptive sizing — the mean of the last few
    // samples, not the last one. A single noisy upload sample must never shrink
    // the chunk size into a death-spiral (tiny chunks -> low rate -> tinier chunks).
    const currentMbps = () => {
      if (!samples.length) return 0;
      const tail = samples.slice(-8);
      return tail.reduce((sum, s) => sum + s.mbps, 0) / tail.length;
    };

    try {
      const workers =
        kind === "download"
          ? Array.from({ length: parallelStreams }, (_, i) =>
              this.downloadWorker(phaseCtrl.signal, counter, currentMbps, i),
            )
          : Array.from({ length: parallelStreams }, (_, i) =>
              this.uploadWorker(phaseCtrl.signal, counter, currentMbps, i),
            );
      await Promise.all(workers);
    } finally {
      clearTimeout(capTimer);
      clearInterval(sampleTimer);
      clearInterval(pingTimer);
      this.controller.signal.removeEventListener("abort", forwardCancel);
    }

    // If the *user* cancelled (not just the phase timer), propagate as abort.
    if (this.aborted) throw new AbortError();

    const durationMs = performance.now() - phaseStart;
    this.loaded[kind] = loadedPings.length ? median(loadedPings) : null;
    // Download uses instantaneous samples (reader timestamps are true wire-arrival
    // times). Upload integrates over a 1 s sliding window, because XHR
    // upload.onprogress fires when bytes enter the OS *send buffer*, not when they
    // hit the wire — so its instantaneous samples arrive in bursts-then-gaps and a
    // raw percentile of them is unreliable. See summarize().
    return this.summarize(samples, counter.bytes, durationMs, warmupMs, kind === "upload" ? "windowed" : "instant");
  }

  /**
   * Per-stream target request duration. Spreading these (0.8×–1.3× of the base
   * target) means streams settle at different chunk sizes and their request
   * boundaries drift apart instead of all landing together — so at any instant
   * most streams are mid-transfer and the summed rate never falls to zero.
   */
  private streamTargetSeconds(index: number): number {
    const n = this.opts.parallelStreams;
    if (n <= 1) return ADAPT_TARGET_S;
    const frac = index / (n - 1); // 0..1 across the streams
    return ADAPT_TARGET_S * (0.8 + 0.5 * frac);
  }

  /** One download stream: fetch → read → count, looping with adaptive size. */
  private async downloadWorker(
    signal: AbortSignal,
    counter: { bytes: number },
    currentMbps: () => number,
    index: number,
  ): Promise<void> {
    // Offset each stream's first request so their boundaries start out spread.
    if (index > 0) await sleep(index * STREAM_STAGGER_MS);
    const targetS = this.streamTargetSeconds(index);
    let chunk = DL_START_CHUNK;
    while (!signal.aborted) {
      const url = `${this.opts.baseUrl}/down?bytes=${chunk}&cb=${cb()}`;
      try {
        const resp = await fetch(url, { cache: "no-store", signal });
        if (!resp.ok || !resp.body) throw new Error(`download HTTP ${resp.status}`);
        const reader = resp.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) counter.bytes += value.byteLength;
          if (signal.aborted) {
            await reader.cancel().catch(() => {});
            break;
          }
        }
      } catch (e) {
        if (signal.aborted) break;
        await sleep(120); // transient network blip: brief backoff, then retry
      }
      chunk = this.nextChunk(currentMbps(), chunk, DL_MIN_CHUNK, DL_MAX_CHUNK, targetS);
    }
  }

  /** One upload stream: POST a random Blob via XHR, looping with adaptive size. */
  private async uploadWorker(
    signal: AbortSignal,
    counter: { bytes: number },
    currentMbps: () => number,
    index: number,
  ): Promise<void> {
    if (index > 0) await sleep(index * STREAM_STAGGER_MS);
    const targetS = this.streamTargetSeconds(index);
    let chunk = UL_START_CHUNK;
    while (!signal.aborted) {
      try {
        await this.uploadOnce(clamp(chunk, UL_MIN_CHUNK, UL_POOL_MAX), signal, counter);
      } catch (e) {
        if (signal.aborted || isAbort(e)) break;
        await sleep(120);
      }
      chunk = this.nextChunk(currentMbps(), chunk, UL_MIN_CHUNK, UL_POOL_MAX, targetS);
    }
  }

  /** Single XHR upload. xhr.upload.onprogress feeds the live throughput counter. */
  private uploadOnce(
    bytes: number,
    signal: AbortSignal,
    counter: { bytes: number },
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new AbortError());
      const xhr = new XMLHttpRequest();
      this.activeXhrs.add(xhr);
      let lastLoaded = 0;
      const onAbort = () => xhr.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      const cleanup = () => {
        signal.removeEventListener("abort", onAbort);
        this.activeXhrs.delete(xhr);
      };

      // fetch() exposes NO upload progress — this is the whole reason we use XHR.
      // (`e` is the DOM ProgressEvent, inferred from the handler signature; we
      // don't annotate it because the imported engine ProgressEvent shadows it.)
      xhr.upload.onprogress = (e) => {
        const delta = e.loaded - lastLoaded;
        lastLoaded = e.loaded;
        if (delta > 0) counter.bytes += delta;
      };
      xhr.onload = () => {
        if (bytes > lastLoaded) counter.bytes += bytes - lastLoaded; // tail not reported by onprogress
        cleanup();
        resolve();
      };
      xhr.onerror = () => {
        cleanup();
        reject(new Error("upload network error"));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new AbortError());
      };

      xhr.open("POST", `${this.opts.baseUrl}/up?cb=${cb()}`);
      // Incompressible random bytes from crypto.getRandomValues — POSTing zeros
      // would let a CDN gzip them away and report a wildly inflated upload speed.
      const pool = this.getUploadPool(bytes);
      const blob = new Blob([pool.subarray(0, bytes)], { type: "application/octet-stream" });
      xhr.send(blob);
    });
  }

  /**
   * Lazily build a pool of crypto-random bytes, reused across upload requests.
   * crypto.getRandomValues() rejects requests larger than 65536 bytes, so we
   * fill the buffer one 64 KB window at a time. The pool is one big random blob
   * (not a small block repeated), so it stays incompressible end to end.
   */
  private getUploadPool(size: number): Uint8Array<ArrayBuffer> {
    const need = clamp(size, UL_MIN_CHUNK, UL_POOL_MAX);
    if (!this.uploadPool || this.uploadPool.byteLength < need) {
      const buf = new Uint8Array(need);
      for (let off = 0; off < need; off += 65536) {
        crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, need)));
      }
      this.uploadPool = buf;
    }
    return this.uploadPool;
  }

  /** Adaptive request size: aim for ~targetS seconds of transfer each. */
  private nextChunk(
    curMbps: number,
    prev: number,
    lo: number,
    hi: number,
    targetS: number = ADAPT_TARGET_S,
  ): number {
    if (curMbps > 0) {
      const bytesPerSec = (curMbps * 1e6) / 8;
      return clamp(Math.round(bytesPerSec * targetS), lo, hi);
    }
    return clamp(prev * 2, lo, hi); // no reading yet: double until we have one
  }

  /**
   * Turn raw samples into a PhaseResult.
   *
   * - "instant"  (download): 90th percentile of post-warmup instantaneous samples.
   *   p90 captures the link's sustained ceiling while the slow-start ramp and brief
   *   dips sit below it and don't drag the headline down.
   * - "windowed" (upload): 90th percentile of throughput measured over a 1 s
   *   *sliding window* of cumulative bytes. Integrating over a second cancels the
   *   send-buffer front-loading and the gaps that make raw XHR upload samples
   *   bursty, so the number is stable instead of swinging wildly run-to-run.
   *
   * Both fall back to a simple bytes/time average when a phase is too short to
   * produce enough samples.
   */
  private summarize(
    samples: ThroughputSample[],
    bytes: number,
    durationMs: number,
    warmupMs: number,
    mode: "instant" | "windowed",
  ): PhaseResult {
    const pool =
      mode === "windowed"
        ? this.windowedRates(samples, warmupMs, 1000)
        : samples.filter((s) => s.t >= warmupMs && s.mbps > 0).map((s) => s.mbps);

    const headline = pool.length >= 3 ? percentile(pool, 90) : bytesToMbps(bytes, durationMs);
    const refPool = pool.length ? pool : samples.map((s) => s.mbps);
    return {
      mbps: headline,
      meanMbps: mean(refPool),
      peakMbps: max(refPool),
      samples,
      bytes,
      durationMs,
    };
  }

  /**
   * Throughput over a trailing `windowMs` window, evaluated at each sample whose
   * window lies entirely after warmup. Rate = (Δ cumulative bytes) / (Δ time).
   */
  private windowedRates(
    samples: ThroughputSample[],
    warmupMs: number,
    windowMs: number,
  ): number[] {
    const rates: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const end = samples[i];
      if (end.t < warmupMs + windowMs) continue; // window must clear the warmup
      let j = i;
      while (j > 0 && end.t - samples[j - 1].t <= windowMs) j--;
      const start = samples[j];
      const dt = end.t - start.t;
      const db = end.bytes - start.bytes;
      if (dt > 0 && db >= 0) rates.push(bytesToMbps(db, dt));
    }
    return rates;
  }

  private computeBufferbloat(): Bufferbloat {
    const delta = (loaded: number | null): number | null =>
      loaded === null ? null : Math.max(0, loaded - this.idleMedian);
    const download = delta(this.loaded.download);
    const upload = delta(this.loaded.upload);
    const present = [download, upload].filter((x): x is number => x !== null);
    const worst = present.length ? max(present) : null;
    return { download, upload, worst, grade: bufferbloatGrade(worst) };
  }
}

/** Convenience factory mirroring the callback shape. */
export function createSpeedTest(
  options: EngineOptions,
  callbacks?: EngineCallbacks,
): SpeedTestEngine {
  return new SpeedTestEngine(options, callbacks);
}

# How Pacer works

A deep dive into the measurement methodology. If you just want to run or fork the
project, see the [Tutorial](TUTORIAL.md). For the short version, see the
[README](README.md#methodology-in-plain-language).

The thesis: a speed test is only as good as the dozen small decisions hidden inside
it. Most "speed test in 200 lines" demos get several of them wrong and under-report
by 2–5×. This document walks through each decision Pacer makes and why.

---

## 1. The two halves

```
┌─────────────────────────────┐         ┌────────────────────────────────┐
│  Browser (the engine)       │  HTTP   │  Cloudflare Worker (the backend) │
│  src/engine/speedtest.ts    │ ──────► │  worker/src/index.ts             │
│  - times everything         │         │  GET  /down?bytes=N  (stream)    │
│  - opens parallel streams   │ ◄────── │  POST /up            (drain)     │
│  - does all the statistics  │         │  GET  /meta          (cf info)   │
└─────────────────────────────┘         └────────────────────────────────┘
```

All measurement happens in the browser. The Worker is deliberately dumb: it
produces bytes, swallows bytes, and reports who you are. That split is what keeps
the backend portable — only `request.cf` (for `/meta`) and `wrangler deploy` are
Cloudflare-specific.

---

## 2. The backend, header by header

### `GET /down?bytes=N` — produce N bytes

```ts
const stream = new ReadableStream({
  pull(controller) {
    if (sent >= total) { controller.close(); return; }
    const size = Math.min(CHUNK_SIZE, total - sent); // 64 KB at a time
    const chunk = new Uint8Array(size);
    crypto.getRandomValues(chunk);                    // fresh random per chunk
    controller.enqueue(chunk);
    sent += size;
  },
});
```

- **Generated on the fly**, never stored. Memory stays flat no matter how large `N`.
- **Fresh random bytes per chunk.** If you reused one buffer, a CDN or `Content-Encoding`
  layer could compress the repetition and you'd measure compression, not bandwidth.
- **`N` is clamped to 100 MB** so a hostile query string can't ask the Worker to
  stream forever.

Headers that matter:

| Header | Why |
| --- | --- |
| `Access-Control-Allow-Origin: *` | The frontend is cross-origin (Pages ↔ workers.dev). |
| `Cache-Control: no-store` | A cached response would measure your disk, not the network. |
| `Timing-Allow-Origin: *` | **The non-obvious one.** Without it, a cross-origin browser zeroes out `PerformanceResourceTiming.responseStart`, and the ping phase can't read time-to-first-byte. |
| `Content-Encoding: identity` | Belt-and-suspenders against transparent compression. |

### `POST /up` — swallow bytes

```ts
const reader = request.body.getReader();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  received += value.byteLength;   // count and discard
}
```

Pull-and-drop: the body is never buffered whole, so a 50 MB upload costs the Worker
no memory. It returns `{ bytes }` so the client can cross-check.

### `GET /meta` — who are you

Sourced entirely from Cloudflare, no third-party geo-IP service:

```ts
{
  ip:      request.headers.get("CF-Connecting-IP"),
  isp:     request.cf.asOrganization,
  asn:     request.cf.asn,
  colo:    request.cf.colo,      // which edge datacenter served you
  country: request.cf.country,
}
```

---

## 3. Timing: `performance.now()`, never `Date.now()`

`Date.now()` is wall-clock time. It can jump backwards (NTP adjustments, the user
changing the clock) and its resolution is coarse. Every duration in Pacer comes from
`performance.now()`, a **monotonic** clock that only moves forward.

The one exception is the results **timestamp** ("tested at 10:35 PM") — that
legitimately wants wall-clock time, so it uses `Date.now()`. It is never used for a
measurement.

---

## 4. Latency & jitter

~20 sequential `GET /down?bytes=0`. An empty body means the response resolves right
after the headers arrive, so the round trip is essentially pure latency.

**RTT is read from the browser's own record**, not a stopwatch:

```ts
const entry = performance.getEntriesByName(url).at(-1);
return entry.responseStart - entry.requestStart;  // = time to first byte
```

`requestStart` is *after* the connection is established and `responseStart` is the
first response byte, so this delta excludes DNS/TLS setup — it's the cleanest RTT the
browser can give you. (It's non-zero only because the Worker sent
`Timing-Allow-Origin: *`. If it ever is zero, the code falls back to a
`performance.now()` delta around the request.) A throwaway probe runs first so the
connection is already warm.

From the samples:

- **min** — your best-case latency.
- **median** — your typical latency (robust to one slow outlier).
- **jitter** — `mean(|RTTᵢ − RTTᵢ₋₁|)`, the average change between *consecutive*
  pings. This is deliberately not the standard deviation: what degrades a call or a
  game is latency *wobbling sample to sample*, not its spread around the mean.

---

## 5. Download

### Parallel streams, summed

This is the single biggest reason naive tests under-report. One TCP connection is
limited by its congestion window and a single round-trip's worth of in-flight data;
on a fast link it simply can't keep the pipe full. Pacer opens **5 streams in
parallel** and sums their byte rates:

```ts
Array.from({ length: 5 }, () => this.downloadWorker(signal, counter, currentMbps));
// every worker does counter.bytes += value.byteLength as chunks arrive
```

A shared `counter` is incremented by all workers; a sampler reads it on a timer.

### Discard the warm-up (TCP slow-start)

TCP starts slow and ramps its congestion window over the first ~second. If you
average that ramp in, you under-report. Pacer **throws away the first 1.2 s** of
samples and only keeps the steady state.

### Adaptive request size

Each request aims to last ~1.5 s. Too small and per-request overhead dominates; too
large and the phase can't react. The next size is computed from the measured rate:

```ts
chunk = clamp(currentRate_bytesPerSec * 1.5, 256 KB, 32 MB);
```

`currentRate` is a **smoothed** mean of the last few samples, never a single noisy
reading — otherwise a momentary dip could shrink the chunk and spiral the rate down.

### The headline number: 90th percentile

A saturated link spends most of its time near its true ceiling. The mean gets dragged
down by the warm-up tail and transient dips; the max is a fluke. The **90th
percentile** of the post-warm-up throughput samples sits right at the sustained
ceiling — which is the number you actually care about.

For download, samples are reliable: each chunk is counted the moment it *arrives*
(reader timestamps are real wire-arrival times), so a percentile of them is sound.

### Caps

Each phase stops at **~13 s** or **~100 MB**, whichever comes first, so the test
never runs away with your data plan.

---

## 6. Upload — and why it's trickier

### `XMLHttpRequest`, not `fetch`

`fetch()` exposes **no upload progress** — you can't see bytes leaving until the whole
request finishes. `XMLHttpRequest` does, via `xhr.upload.onprogress`, which is the only
way to draw a live upload chart. So the upload phase uses XHR.

### Incompressible payloads — never zeros

The body is filled from `crypto.getRandomValues()` (which caps at 65536 bytes per
call, so we fill a buffer in a loop and reuse the pool). If you POST a buffer of
zeros, any compression layer squashes it to nothing and you'll "measure" a fantasy
upload speed. Random bytes don't compress.

### The send-buffer problem (the subtle one)

`xhr.upload.onprogress` reports bytes when they enter the **operating system's send
buffer**, not when they reach the network. On a fast machine the OS accepts several
megabytes instantly, fires one big progress event, then goes quiet while the buffer
drains over the wire. So the *instantaneous* upload rate arrives in **bursts followed
by gaps** — and a naive 90th percentile of those samples is unstable. (An early build
of Pacer reported **1.6 Mbps** on a link that actually does ~36.)

The fix: for upload, the headline is the **90th percentile of the rate measured over a
1-second sliding window** of cumulative bytes:

```ts
rate = (bytesAt(t) − bytesAt(t − 1s)) / 1s
```

Integrating over a full second cancels the front-loading and the gaps — over any
1-second window in steady state, "bytes accepted into the buffer" equals "bytes that
left over the wire" (the buffer is bounded). The result is stable run to run.

> **Different aggregation per direction is intentional.** Download uses instantaneous
> samples because its timestamps are true wire-arrival times. Upload uses a sliding
> window because its timestamps reflect buffer acceptance. The method matches the
> measurement mechanism.

The live number and chart additionally use a short (600 ms) trailing window so the
displayed value is smooth instead of flickering between a spike and zero.

---

## 7. Loaded latency & bufferbloat

While a transfer is saturating your link, Pacer keeps pinging (every ~350 ms). When
your upstream buffer fills, packets queue behind the bulk transfer and latency
balloons — that's **bufferbloat**.

```
bufferbloat = median(loaded RTT) − median(idle RTT)
```

It's graded A–F (A: <5 ms added, F: ≥200 ms). A fast connection with grade F still
feels terrible on calls during an upload — this number surfaces that.

---

## 8. Units: bits vs bytes

The most-botched constant in the category. Network speeds are quoted in **megabits**
(what your ISP advertises), file sizes in **megabytes**.

```ts
Mbps = (bytes × 8) / seconds / 1e6        // decimal mega, not 1<<20
MB/s = Mbps / 8
```

Pacer computes everything in Mbps in exactly one place (`src/engine/stats.ts`) and
only converts for display. The `MB/s` toggle divides by 8 — nothing else.

---

## 9. The statistics, precisely

All in `src/engine/stats.ts`, dependency-free:

- **percentile(values, p)** — linear interpolation (the "R-7" method used by NumPy and
  Excel): `rank = p/100 × (n−1)`, interpolate between the two neighbouring sorted
  values.
- **jitter(rtts)** — `Σ|rttᵢ − rttᵢ₋₁| / (n−1)`.
- **median / mean / min / max** — the obvious definitions, used for the reference
  stats shown alongside the headline.

---

## 10. Lifecycle & cancellation

The engine is a small state machine: `meta → ping → download → upload → done`. It
reports through callbacks (`onPhaseChange`, `onProgress`, `onMeta`, `onComplete`,
`onError`) and is driven into React state by `src/hooks/useSpeedTest.ts`.

Cancellation is `AbortController`-based. A user **Stop** aborts the top-level
controller; each phase also has its own controller that fires on the time/byte cap.
In-flight `fetch()`es abort via their signal; in-flight `XHR`s are tracked in a `Set`
and `.abort()`ed. After a phase, the engine checks the *top-level* signal to tell a
user-cancel apart from a normal cap-triggered end.

---

## 11. Why this beats a naive test — the checklist

| Common mistake | What it does | What Pacer does |
| --- | --- | --- |
| Single connection | Under-reports fast links badly | 5 parallel streams, summed |
| Averages in TCP slow-start | Under-reports | Discards a 1.2 s warm-up |
| Uses the mean | Dragged down by dips | 90th percentile |
| `Date.now()` timing | Coarse, can jump | `performance.now()` + Resource Timing TTFB |
| `fetch` for upload | No progress; can't measure live | `XMLHttpRequest` + `onprogress` |
| Uploads zeros | Compressed → fake-fast | `crypto.getRandomValues()` |
| Trusts XHR instantaneous rate | Bursty → unstable | 1 s sliding-window percentile |
| Confuses Mbps/MB·s | Off by 8× | One conversion point, audited |
| No latency-under-load | Misses bufferbloat | Pings during transfers |

That checklist *is* the project.

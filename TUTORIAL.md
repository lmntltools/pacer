# Tutorial

Get Pacer running locally, understand the codebase, use the engine on its own, and
deploy your own copy. For the measurement theory, read [How it works](HOW_IT_WORKS.md).

- [1. Prerequisites](#1-prerequisites)
- [2. Run it locally](#2-run-it-locally)
- [3. Point it at your own backend](#3-point-it-at-your-own-backend)
- [4. Read a result](#4-read-a-result)
- [5. Tour of the codebase](#5-tour-of-the-codebase)
- [6. Use the engine on its own](#6-use-the-engine-on-its-own)
- [7. Tune the engine](#7-tune-the-engine)
- [8. Deploy your own copy](#8-deploy-your-own-copy)
- [9. Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

- **Node 20+** and npm
- A **Cloudflare account** (free) only if you want to run your own backend; otherwise
  the app talks to the already-deployed Worker out of the box.

```bash
git clone https://github.com/simdexapp/pacer.git
cd pacer
npm install
```

---

## 2. Run it locally

```bash
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Press **Start test** — it will
run against the public Worker at `pacer-speedtest.simdexapp.workers.dev`.

Type-check and produce a production build any time with:

```bash
npm run build      # tsc -b && vite build  →  dist/
npm run preview    # serve the built dist/ locally
```

---

## 3. Point it at your own backend

The frontend reads the backend URL from **one place**: `src/config.ts` →
`WORKER_BASE_URL`. You can override it without editing code via an env var.

**Run the Worker locally** (full stack on your machine):

```bash
npm run worker:dev          # wrangler dev → http://localhost:8787
```

Then create a `.env` (see `.env.example`) so the frontend targets it:

```bash
# .env
VITE_WORKER_URL=http://localhost:8787
```

Restart `npm run dev`. Now both halves are local. (Vite only reads `.env` at startup.)

**Or deploy your own Worker** (see [section 8](#8-deploy-your-own-copy)) and put its
URL in `VITE_WORKER_URL` or the `src/config.ts` fallback.

---

## 4. Read a result

| Metric | Meaning |
| --- | --- |
| **Download / Upload** | Sustained throughput (90th-percentile), in Mbps (toggle to MB/s). |
| **Ping** | Median round trip; `min` is your best case. |
| **Jitter** | Average change between consecutive pings — lower is steadier. |
| **Loaded latency** | Ping *while the link is saturated* (↓ during download, ↑ during upload). |
| **Bufferbloat** | How much latency grew under load vs idle, graded A–F. |

The telemetry strip up top (IP / ISP / ASN / colo / country) comes from the Worker's
`/meta` route. **Copy** / **Share** export a plain-text summary.

---

## 5. Tour of the codebase

```
pacer/
├─ worker/
│  ├─ src/index.ts          # the entire backend: /down, /up, /meta, CORS
│  └─ wrangler.toml         # Worker config + deploy settings
├─ src/
│  ├─ config.ts             # WORKER_BASE_URL — the one backend pointer
│  ├─ engine/               # ★ the measurement engine (framework-agnostic)
│  │  ├─ speedtest.ts       #   SpeedTestEngine: phases, parallelism, sampling
│  │  ├─ stats.ts           #   percentile / jitter / median / bits↔bytes
│  │  └─ types.ts           #   typed results, options, callbacks
│  ├─ hooks/
│  │  └─ useSpeedTest.ts    # React binding around the engine
│  ├─ components/           # UI: TopBar, PhaseRail, Hero, Oscilloscope, …
│  ├─ lib/                  # formatting + share/clipboard helpers
│  └─ App.tsx               # composes the instrument-cluster layout
└─ .github/workflows/deploy.yml   # builds + publishes to GitHub Pages
```

The engine knows nothing about React. The UI is a thin shell over it.

---

## 6. Use the engine on its own

`SpeedTestEngine` is a standalone module — drop it into any frontend (or a Node script
with `fetch`/`XHR` shims):

```ts
import { SpeedTestEngine } from "./src/engine/speedtest";

const engine = new SpeedTestEngine(
  { baseUrl: "https://pacer-speedtest.simdexapp.workers.dev" },
  {
    onPhaseChange: (phase) => console.log("phase:", phase),
    onProgress: (e) => {
      if (e.mbps != null) console.log("now:", e.mbps.toFixed(1), "Mbps");
    },
    onComplete: (r) => {
      console.log("download", r.download?.mbps.toFixed(1), "Mbps");
      console.log("upload  ", r.upload?.mbps.toFixed(1), "Mbps");
      console.log("ping    ", r.latency?.median.toFixed(0), "ms");
      console.log("bufferbloat grade", r.bufferbloat.grade);
    },
    onError: (err) => console.error(err),
  },
);

const result = await engine.start();  // Promise<SpeedTestResult | null>
// engine.cancel();                   // abort cleanly at any time
```

`start()` resolves with the full `SpeedTestResult`, or `null` if cancelled. See
`src/engine/types.ts` for the complete shape.

---

## 7. Tune the engine

Pass an `EngineOptions` object to override any default:

```ts
new SpeedTestEngine({
  baseUrl: "…",
  parallelStreams: 6,        // default 5  — concurrent connections per phase
  pingCount: 30,             // default 20 — idle latency probes
  warmupMs: 1500,            // default 1200 — slow-start window discarded
  maxPhaseMs: 15000,         // default 13000 — time cap per transfer phase
  maxBytesPerPhase: 100e6,   // default 100 MB — data cap per phase
  sampleIntervalMs: 100,     // default 100 — how often the chart samples
});
```

Rules of thumb:

- **More `parallelStreams`** helps saturate very fast links but adds overhead on slow
  ones; 4–6 is the sweet spot.
- **Raise `warmupMs`** if you see the first second dragging your number down.
- **Lower the caps** to be gentler on metered connections.

---

## 8. Deploy your own copy

### Deploy the Worker

```bash
npx wrangler login
npx wrangler deploy --config worker/wrangler.toml
```

Wrangler prints a URL like `https://pacer-speedtest.<your-subdomain>.workers.dev`.
Put it in `src/config.ts` (`WORKER_BASE_URL`) or set `VITE_WORKER_URL` at build time.

### Deploy the frontend to GitHub Pages

1. Fork/push the repo under your account.
2. Because Pages serves from `https://<you>.github.io/<repo>/`, set Vite's `base` in
   `vite.config.ts` to `"/<your-repo>/"`.
3. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes
   `dist/` automatically.

That's it — your fork is live with its own backend.

---

## 9. Troubleshooting

**Numbers look way too low.**
Open DevTools → Network during a test. You should see **5 `/down` requests open at
once** per phase. If you see one at a time, parallelism isn't kicking in — check that
`parallelStreams` wasn't lowered.

**Ping shows odd/equal values, or download TTFB is 0.**
The Worker must send `Timing-Allow-Origin: *`. If you ported the backend, make sure
that header is present, or the browser hides `responseStart` cross-origin and the
engine falls back to a coarser RTT.

**CORS errors in the console.**
The Worker must answer `OPTIONS` preflight and send `Access-Control-Allow-Origin: *`
on every route. Confirm your `worker/src/index.ts` matches the original.

**Upload is implausibly low or spiky.**
That's the XHR send-buffer effect — Pacer already corrects for it with a sliding-window
measurement (see [How it works §6](HOW_IT_WORKS.md#6--upload--and-why-its-trickier)).
If you changed the upload code, keep the windowed aggregation.

**The dev server can't reach a local Worker.**
`wrangler dev` defaults to `http://localhost:8787`. Make sure `VITE_WORKER_URL`
matches and that you restarted `npm run dev` after editing `.env`.

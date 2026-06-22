# Contributing

Thanks for taking a look. Pacer is small and deliberately dependency-light — the goal
is that any one file fits in your head.

- [Development setup](#development-setup)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [Coding conventions](#coding-conventions)
- [Testing your changes](#testing-your-changes)
- [Porting the Worker to Deno / Node](#porting-the-worker-to-deno--node)
- [Submitting changes](#submitting-changes)
- [Scope & non-goals](#scope--non-goals)

---

## Development setup

```bash
git clone https://github.com/simdexapp/pacer.git
cd pacer
npm install
npm run dev          # frontend against the public Worker
```

To run the **full stack locally**, start the Worker and point the frontend at it:

```bash
npm run worker:dev   # wrangler dev → http://localhost:8787
echo "VITE_WORKER_URL=http://localhost:8787" > .env
npm run dev          # restart so Vite picks up .env
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (HMR). |
| `npm run build` | `tsc -b && vite build` → `dist/`. Must pass clean before a PR. |
| `npm run typecheck` | Type-check without emitting. |
| `npm run preview` | Serve the production `dist/` locally. |
| `npm run worker:dev` | `wrangler dev` for the backend. |
| `npm run worker:deploy` | `wrangler deploy` the backend. |

---

## Project layout

See the [Tutorial tour](TUTORIAL.md#5-tour-of-the-codebase) for the full tree. The
load-bearing parts:

- **`src/engine/`** — the measurement engine. Framework-agnostic, no React, no DOM
  beyond `fetch`/`XHR`/`performance`. This is where the interesting work lives.
- **`worker/src/index.ts`** — the entire backend in one file.
- **`src/hooks/useSpeedTest.ts`** — the only bridge between the engine and React.
- **`src/components/`** — presentational UI; no measurement logic.

A good rule: **measurement logic goes in `engine/`, never in a component.**

---

## Coding conventions

- **TypeScript strict mode** is on (`noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`, …). `npm run build` enforces it.
- **Comment the *why*, not the *what*.** The engine is full of "this looks odd but
  here's the networking reason" comments — keep that style. The non-obvious decisions
  are the point of the project.
- **All durations use `performance.now()`**, never `Date.now()` (except the single
  results wall-clock timestamp).
- **Numerics render in a monospace font with `tabular-nums`** so digits don't reflow
  while updating. Use the existing `.tnum` utility / `font-mono`.
- **One unit conversion point.** Throughput is computed in Mbps in `stats.ts`; convert
  to MB/s only for display. Don't sprinkle `× 8` / `/ 8` around.
- **Theming:** one accent (cyan-green `#3DF5C4`) on near-black, used with restraint.
  No new colors without a reason.
- **Accessibility:** keep things keyboard-operable, preserve the `aria-live` status
  region, and honour `prefers-reduced-motion` (the chart already swaps to a static
  view).

### Hard rules

- **No third-party speed-test library or endpoint.** Not `@cloudflare/speedtest`, not
  LibreSpeed, not someone else's test servers. Writing the measurement ourselves is
  the entire reason this project exists.
- **Never fabricate or simulate numbers.** Every value on screen is measured.
- **Upload uses `XMLHttpRequest`** (for progress) with **incompressible random**
  payloads — never `fetch`, never zeros.

---

## Testing your changes

There's no unit-test suite yet (contributions welcome — `stats.ts` is pure and the
obvious first target). For now, verify by hand:

1. `npm run build` passes with no type errors.
2. Run a real test and **open DevTools → Network**: confirm **5 `/down` (then `/up`)
   requests open concurrently** per phase.
3. **Sanity-check the numbers** against a reference test on the same connection —
   they should be in the same ballpark (parallel-stream tests can legitimately read a
   bit higher than single-stream ones).
4. **Cancel mid-run** (the Stop button) — it should abort cleanly with no console
   errors and return to idle.
5. **No console errors or warnings** at any point.
6. Check **mobile** (DevTools device toolbar) and **`prefers-reduced-motion`**.

If you touched `stats.ts`, spot-check the math: e.g. `percentile([1..10], 90)` ≈ 9.1,
`jitter([10, 12, 11])` = 1.5.

---

## Porting the Worker to Deno / Node

The backend is standard Web Streams plus one Cloudflare-specific bit (`request.cf`).
Porting is mostly swapping how you read request metadata.

**Deno (`Deno.serve`)** — almost a drop-in; `ReadableStream`, `Response`, `crypto`,
and `URL` are all built in. Replace the `/meta` source:

```ts
// instead of request.cf.asOrganization / .asn / .colo / .country:
const ip = request.headers.get("x-forwarded-for") ?? conn.remoteAddr.hostname;
// ISP/ASN/colo aren't available without a geo-IP source; return what you have.
```

**Node (`node:http` or a framework)** — same idea, plus:

- Use the Web Streams API (`node:stream/web`) or stream chunks via the response.
- `crypto.getRandomValues` lives on `globalThis.crypto` (Node 19+) or
  `node:crypto.webcrypto`.
- For `/up`, read the request stream and discard chunks; don't buffer the whole body.
- Read the client IP from `x-forwarded-for` / `req.socket.remoteAddress`.

Keep the **same headers** regardless of platform — especially
`Access-Control-Allow-Origin: *` and `Timing-Allow-Origin: *`, or the engine's TTFB
ping breaks.

The frontend doesn't care what's behind `WORKER_BASE_URL`; point it anywhere that
speaks these three routes.

---

## Submitting changes

1. Branch off `main`.
2. Make the change; keep the diff focused.
3. Ensure `npm run build` passes and you've run the manual checks above.
4. Open a PR describing **what** changed and **why** — and for any measurement change,
   how you verified the numbers are still accurate (a before/after against a reference
   test is ideal).

Small, well-explained PRs get merged fastest.

---

## Scope & non-goals

**In scope:** measurement accuracy, the engine API, the instrument UI, accessibility,
the backend's portability, docs.

**Out of scope (for now):** accounts/history/storage, server-side result logging, a
results leaderboard, multi-server selection. Pacer is a focused, self-contained tool —
let's keep it that way unless there's a strong case.

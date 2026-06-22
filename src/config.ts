/**
 * Single source of truth for the backend location.
 *
 * The frontend never hard-codes the Worker URL anywhere else — every request the
 * engine makes is built from WORKER_BASE_URL. To point the app at a different
 * backend (e.g. a Deno/Node port, or your own Worker), either:
 *   - set VITE_WORKER_URL at build time (CI / `.env`), or
 *   - edit the fallback string below.
 */
export const WORKER_BASE_URL: string =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://pacer-speedtest.simdexapp.workers.dev";

export const APP_NAME = "Pacer";
export const APP_TAGLINE = "Precision internet speed test";

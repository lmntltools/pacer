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
/** Model designation shown beside the wordmark — house-style "rack unit" label. */
export const APP_MODEL = "SPD-1";

/**
 * The app's ONLY third-party request: an IPv4-only echo used to show the familiar
 * dotted-quad (the Worker usually sees IPv6 on a dual-stack network). It reveals
 * the visitor's IP to that host and nothing else — every speed *measurement*
 * stays first-party. Set to false for a zero-third-party build (the IPv4 line is
 * simply hidden; the Worker-seen IP still shows). Overridable via VITE_IPV4_ECHO.
 */
export const ENABLE_IPV4_ECHO: boolean =
  (import.meta.env.VITE_IPV4_ECHO as string | undefined) !== "false";
export const IPV4_ECHO_URL = "https://api4.ipify.org?format=json";

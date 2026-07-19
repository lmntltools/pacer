/**
 * Pacer — speed-test backend (single Cloudflare Worker, hand-written).
 *
 * Routes
 *   GET  /down?bytes=N  -> streams N bytes of fresh, incompressible random data
 *   POST /up            -> drains and discards the request body, returns byte count
 *   GET  /meta          -> JSON connection info sourced from request.cf + CF headers
 *   OPTIONS *           -> CORS preflight
 *
 * Design notes
 *   - Bytes are generated on the fly via a ReadableStream; nothing is stored.
 *   - `Timing-Allow-Origin: *` is REQUIRED: without it a cross-origin browser
 *     zeroes out PerformanceResourceTiming.responseStart, which the engine needs
 *     to compute time-to-first-byte for the ping/jitter phase.
 *   - Only two things here are Cloudflare-specific: the `request.cf` metadata and
 *     `wrangler deploy`. Porting to Deno/Node is a matter of swapping those for
 *     the platform's request-info API — the streaming/draining logic is standard
 *     Web Streams and works unchanged.
 */

// Hard cap so a hostile query string can't ask us to stream forever. The client
// never requests more than 32 MB in a single /down, so this is comfortably above
// any legitimate request while bounding what one abusive call can drain.
const MAX_BYTES = 64 * 1024 * 1024; // 64 MB
// Web Crypto fills at most 65536 bytes per getRandomValues() call.
const CHUNK_SIZE = 65536; // 64 KB

// Only these origins may READ the responses cross-origin. This is the browser
// app talking to its backend, so we lock it to the deployed site + local dev
// instead of "*", which would let any website use this Worker as free bandwidth.
// Fork or use a custom domain? Add your origin here (scheme + host, no path).
const ALLOWED_ORIGINS = new Set<string>([
  "https://simdexapp.github.io", // production (GitHub Pages)
  "http://localhost:5173", // vite dev
  "http://localhost:4173", // vite preview
]);

const CORS_BASE: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

/** Cloudflare attaches request metadata under `request.cf`. */
interface CfProperties {
  asOrganization?: string;
  asn?: number;
  colo?: string;
  country?: string;
}

/**
 * Build response headers with CORS scoped to the caller's origin. We reflect the
 * request's Origin only when it's on the allowlist (and add `Vary: Origin` so
 * caches don't cross the streams). Disallowed/absent origins get no
 * Access-Control-Allow-Origin, so a browser on another site can't read the body.
 * Timing-Allow-Origin is reflected the same way — the ping phase needs it, but
 * only our own pages ever benefit from reading Resource Timing.
 */
function withCors(origin: string | null, headers: Record<string, string> = {}): Headers {
  const h = new Headers({ ...CORS_BASE, ...headers });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Timing-Allow-Origin", origin);
    h.set("Vary", "Origin");
  }
  return h;
}

/** GET /down?bytes=N — stream N bytes of random data, generated on the fly. */
function handleDown(url: URL, origin: string | null): Response {
  const requested = Number(url.searchParams.get("bytes"));
  const total = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 0), MAX_BYTES)
    : 0;

  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const size = Math.min(CHUNK_SIZE, total - sent);
      // Fresh random bytes per chunk => incompressible, so no CDN/gzip layer can
      // shrink the payload and inflate the measured download speed.
      const chunk = new Uint8Array(size);
      crypto.getRandomValues(chunk);
      controller.enqueue(chunk);
      sent += size;
    },
  });

  return new Response(stream, {
    headers: withCors(origin, {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(total),
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Encoding": "identity",
    }),
  });
}

/** POST /up — fully read and discard the body; report how many bytes we drained. */
async function handleUp(request: Request, origin: string | null): Promise<Response> {
  let received = 0;
  if (request.body) {
    const reader = request.body.getReader();
    // Pull-and-drop: we never buffer the whole upload, so memory stays flat
    // regardless of how large the client's payload is.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) received += value.byteLength;
    }
  }
  return new Response(JSON.stringify({ bytes: received }), {
    headers: withCors(origin, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
  });
}

/** GET /meta — connection info, sourced entirely from Cloudflare (no 3rd-party geo). */
function handleMeta(request: Request, origin: string | null): Response {
  const cf = (request as Request & { cf?: CfProperties }).cf ?? {};
  const body = {
    ip: request.headers.get("CF-Connecting-IP") ?? "",
    isp: cf.asOrganization ?? "",
    asn: cf.asn ?? null,
    colo: cf.colo ?? "",
    country: cf.country ?? "",
  };
  return new Response(JSON.stringify(body), {
    headers: withCors(origin, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
  });
}

export default {
  fetch(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCors(origin) });
    }

    switch (url.pathname) {
      case "/down":
        if (request.method !== "GET") break;
        return handleDown(url, origin);
      case "/up":
        if (request.method !== "POST") break;
        return handleUp(request, origin);
      case "/meta":
        if (request.method !== "GET") break;
        return handleMeta(request, origin);
      case "/":
        return new Response(
          "Pacer speed-test worker. Routes: GET /down?bytes=N, POST /up, GET /meta",
          { headers: withCors(origin, { "Content-Type": "text/plain" }) },
        );
    }

    return new Response("Not found", { status: 404, headers: withCors(origin) });
  },
};

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

// Hard cap so a hostile query string can't ask us to stream forever.
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
// Web Crypto fills at most 65536 bytes per getRandomValues() call.
const CHUNK_SIZE = 65536; // 64 KB

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
  // Lets cross-origin pages read responseStart/responseEnd from Resource Timing.
  "Timing-Allow-Origin": "*",
};

/** Cloudflare attaches request metadata under `request.cf`. */
interface CfProperties {
  asOrganization?: string;
  asn?: number;
  colo?: string;
  country?: string;
}

function withCors(headers: Record<string, string> = {}): Headers {
  return new Headers({ ...CORS_HEADERS, ...headers });
}

/** GET /down?bytes=N — stream N bytes of random data, generated on the fly. */
function handleDown(url: URL): Response {
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
    headers: withCors({
      "Content-Type": "application/octet-stream",
      "Content-Length": String(total),
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Encoding": "identity",
    }),
  });
}

/** POST /up — fully read and discard the body; report how many bytes we drained. */
async function handleUp(request: Request): Promise<Response> {
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
    headers: withCors({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
  });
}

/** GET /meta — connection info, sourced entirely from Cloudflare (no 3rd-party geo). */
function handleMeta(request: Request): Response {
  const cf = (request as Request & { cf?: CfProperties }).cf ?? {};
  const body = {
    ip: request.headers.get("CF-Connecting-IP") ?? "",
    isp: cf.asOrganization ?? "",
    asn: cf.asn ?? null,
    colo: cf.colo ?? "",
    country: cf.country ?? "",
  };
  return new Response(JSON.stringify(body), {
    headers: withCors({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
  });
}

export default {
  fetch(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCors() });
    }

    switch (url.pathname) {
      case "/down":
        if (request.method !== "GET") break;
        return handleDown(url);
      case "/up":
        if (request.method !== "POST") break;
        return handleUp(request);
      case "/meta":
        if (request.method !== "GET") break;
        return handleMeta(request);
      case "/":
        return new Response(
          "Pacer speed-test worker. Routes: GET /down?bytes=N, POST /up, GET /meta",
          { headers: withCors({ "Content-Type": "text/plain" }) },
        );
    }

    return new Response("Not found", { status: 404, headers: withCors() });
  },
};

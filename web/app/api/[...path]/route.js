/** Thin pass-through to the Express API.
 *
 * The frontend and the API used to share one origin: `backend/server.js` served
 * the built SPA and `/api/*` from the same process, so `client.js` could use a
 * relative `/api` base and CORS never came into it. Next.js owns serving the
 * frontend now, and the API is a second App Hosting backend on its own origin —
 * so something has to bridge that, and the options were:
 *
 *   a) point the browser straight at the API origin. Costs a CORS preflight on
 *      every authenticated call, needs CORS_ORIGINS kept in sync with whatever
 *      hostname App Hosting hands out, and puts a second origin in front of
 *      Firebase Auth.
 *   b) proxy through Next. The browser keeps talking to its own origin, every
 *      existing helper in client.js works untouched (including the multipart
 *      and blob ones, which are the fiddly ones), and CORS_ORIGINS stays a
 *      local-dev concern.
 *
 * (b), at the cost of one hop inside Google's network.
 *
 * The Authorization header is forwarded verbatim and nothing else is inspected:
 * this file must never become a place where auth decisions are made. The
 * backend re-verifies the Firebase ID token on every request and resolves the
 * caller's role from Firestore, exactly as it did before — that is still the
 * only thing standing between a request and the data.
 */
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:8000";

// Hop-by-hop and length headers: node/undici recomputes these for the outgoing
// and incoming bodies, and passing the originals through corrupts the response
// (a forwarded content-length that disagrees with a re-encoded body truncates
// it). `host` must go too, or the upstream sees this app's hostname.
const STRIP = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
]);

function forwardHeaders(source) {
  const out = new Headers();
  for (const [key, value] of source.entries()) {
    if (!STRIP.has(key.toLowerCase())) out.set(key, value);
  }
  return out;
}

async function proxy(request, { params }) {
  const { path } = await params;
  const search = new URL(request.url).search;
  const target = `${API_ORIGIN}/api/${(path || []).map(encodeURIComponent).join("/")}${search}`;

  const init = {
    method: request.method,
    headers: forwardHeaders(request.headers),
    // Streamed through as-is, so multipart uploads (payment proofs, submission
    // files) keep the boundary the browser generated. duplex is required by
    // undici whenever a request body is a stream.
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    duplex: "half",
    redirect: "manual",
  };

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch {
    // The API being unreachable is a 502, not a 500 — and it has to arrive in
    // the { detail } shape client.js parses, or the UI shows "Request failed"
    // with no explanation.
    return Response.json({ detail: "The API is unreachable. Please try again." }, { status: 502 });
  }

  // Body passed through untouched: JSON, CSV, QR PNGs and submission files all
  // go through this one handler, so it must stay content-agnostic.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardHeaders(upstream.headers),
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

// Every call carries a per-user Firebase token; caching any of it would serve
// one participant's data to the next.
export const dynamic = "force-dynamic";
export const revalidate = 0;

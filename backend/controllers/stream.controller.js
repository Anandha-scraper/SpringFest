/** HTTP layer for GET /api/stream — the server-sent events endpoint.
 *
 * The only long-lived response in this API. Everything about it is shaped by
 * one constraint: App Hosting's runConfig has no timeout setting, so this runs
 * under Cloud Run's default request cap (~5 minutes) and there is no way to
 * raise it from apphosting.yaml. The connection WILL be cut regularly. That is
 * fine and expected — EventSource reconnects on its own — but it is why the
 * `retry:` hint goes out first and why the client refetches on reconnect.
 */
import { subscribe } from "../services/changeStream.js";

/** Comment frames (`:` lines) are ignored by EventSource but still count as
 * traffic, which keeps intermediaries from dropping an idle connection before
 * Cloud Run's own cap does. */
const HEARTBEAT_MS = 25_000;

export async function stream(req, res) {
  res.set({
    "Content-Type": "text/event-stream",
    // no-transform is the part that matters: it tells every proxy in the path
    // to leave the body alone rather than buffering it into a "complete"
    // response, which is how SSE usually dies silently.
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // nginx-family proxies buffer by default; this opts out.
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  // How long the browser waits before reconnecting after the cut above.
  res.write("retry: 3000\n\n");
  res.write(`: connected ${new Date().toISOString()}\n\n`);

  const unsubscribe = subscribe((payload) => {
    res.write(`event: change\ndata: ${payload}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_MS);

  // Fires on a client navigating away, a dropped network, and Cloud Run's own
  // timeout alike — one teardown for every way this ends.
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}

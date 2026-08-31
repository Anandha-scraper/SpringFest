#!/usr/bin/env bash
#
# Smoke-test a deployed (or local) Spring Fest site.
#
#   ./deploy/verify.sh https://your-web-backend.run.app
#   ./deploy/verify.sh http://localhost:5173        # against local dev
#
# Checks only what can be checked without signing in. It is deliberately blunt: each
# failure names the thing to go fix, because the point of this script is to be run by
# someone who has just spent an hour in the Firebase console.
#
# What it CANNOT check, and what you still have to do by hand: signing in, registering
# for an event, uploading a payment screenshot, scanning a QR. Those need a browser and a
# real Google account.
set -uo pipefail

BASE="${1:-}"
[ -n "$BASE" ] || { echo "usage: $0 <base-url>" >&2; exit 2; }
BASE="${BASE%/}"

pass=0; fail=0; warn=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n        \033[33m→ %s\033[0m\n' "$1" "$2"; fail=$((fail+1)); }
note() { printf '  \033[33mWARN\033[0m  %s\n        → %s\n' "$1" "$2"; warn=$((warn+1)); }

# status_of <path> [curl args...]
status_of() { local p="$1"; shift; curl -s -o /dev/null -w '%{http_code}' "$@" "$BASE$p"; }
body_of()   { local p="$1"; shift; curl -s "$@" "$BASE$p"; }

echo "testing $BASE"
echo

# ── The site itself ──────────────────────────────────────────
code="$(status_of /)"
[ "$code" = "200" ] \
  && ok "site responds (200)" \
  || bad "site responds — got $code" "the web backend is not serving; check its latest rollout"

html="$(body_of /)"
grep -q "Spring Fest" <<<"$html" \
  && ok "landing page rendered" \
  || bad "landing page content missing" "the build may have succeeded while the page errored; check runtime logs"

# ── The proxy to the API ─────────────────────────────────────
health="$(body_of /api/health)"
grep -q '"status":"ok"' <<<"$health" \
  && ok "/api/health answers through the proxy" \
  || bad "/api/health did not answer: ${health:0:80}" \
         "API_ORIGIN is wrong, or the API backend is down. This is the #1 thing to check."

events_code="$(status_of /api/events)"
[ "$events_code" = "200" ] \
  && ok "public event list loads (200)" \
  || bad "public event list — got $events_code" "the API cannot reach Firestore; check the Cloud Datastore User IAM grant"

# ── Auth is enforced, and errors are shaped right ────────────
admin="$(body_of /api/admin/attendance)"
admin_code="$(status_of /api/admin/attendance)"
if [ "$admin_code" = "401" ] && grep -q '"detail"' <<<"$admin"; then
  ok "unauthenticated admin route is 401 with a {detail} body"
elif [ "$admin_code" = "502" ]; then
  bad "unauthenticated admin route returned 502" "the proxy cannot reach the API — check API_ORIGIN"
else
  bad "unauthenticated admin route — got $admin_code" "expected 401; anything else means auth is not being enforced as expected"
fi

# The bug that shipped once and would ship again unnoticed: every write returned 502
# because request bodies were streamed to fetch. GETs looked fine throughout.
post_code="$(status_of /api/session -X POST -H 'Content-Type: application/json' -d '{"id_token":"probe"}')"
if [ "$post_code" = "401" ]; then
  ok "POST with a body reaches the API (401, not 502)"
elif [ "$post_code" = "502" ]; then
  bad "POST with a body returned 502" "the proxy is not forwarding request bodies — EVERY write in the app is broken"
else
  note "POST with a body — got $post_code" "expected 401 from a bogus token; not fatal, but worth a look"
fi

# ── Live updates ─────────────────────────────────────────────
stream_headers="$(curl -s -D- -o /dev/null --max-time 10 "$BASE/api/stream" 2>/dev/null || true)"
stream_code="$(grep -oP 'HTTP/[\d.]+ \K\d+' <<<"$stream_headers" | head -1)"
if [ "$stream_code" = "401" ]; then
  ok "/api/stream requires auth (401)"
elif [ "$stream_code" = "502" ]; then
  bad "/api/stream returned 502" "the proxy is not forwarding the stream"
else
  note "/api/stream — got ${stream_code:-no response}" "expected 401 when signed out"
fi

# ── Nothing leaks ────────────────────────────────────────────
grep -qi "access_code" <<<"$(body_of /api/events)" \
  && bad "public event list contains access_code" "toEvent() is leaking a private field — this is a security bug" \
  || ok "public event list leaks no access_code"

if grep -qiE "run\.app|API_ORIGIN" <<<"$html"; then
  note "the API origin may appear in the page HTML" "it should only ever be used server-side; check for a NEXT_PUBLIC_ leak"
else
  ok "API origin not exposed in the page"
fi

echo
printf '%s passed, %s failed, %s warnings\n' "$pass" "$fail" "$warn"
if [ "$fail" -gt 0 ]; then
  echo
  echo "Still to do by hand (this script cannot): sign in, register for an event,"
  echo "upload a payment proof, scan a QR at check-in."
  exit 1
fi
echo
echo "Automated checks are green. Now do the by-hand pass: sign in, register for an"
echo "event, and check someone in from a second device."

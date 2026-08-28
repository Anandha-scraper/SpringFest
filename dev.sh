#!/usr/bin/env bash
# Runs backend + frontend together. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")"

[ -f backend/serviceAccountKey.json ] || { echo "missing backend/serviceAccountKey.json"; exit 1; }
[ -d frontend/node_modules ] || (cd frontend && npm install)

# .venv/bin/uvicorn works without activating the venv
(cd backend && exec .venv/bin/uvicorn app.main:app --reload --port 8000) &
back=$!
(cd frontend && exec npm run dev) &
front=$!

# uvicorn --reload and npm each spawn a child that outlives the parent,
# so kill descendants first, then the two we started.
cleanup() { pkill -P "$back" 2>/dev/null; pkill -P "$front" 2>/dev/null; kill "$back" "$front" 2>/dev/null; }
trap cleanup EXIT INT TERM
echo "backend  -> http://localhost:8000"
echo "frontend -> http://localhost:5173"
wait

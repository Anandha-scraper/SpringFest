#!/usr/bin/env bash
# Runs backend + frontend together. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")"

[ -f backend/serviceAccountKey.json ] || { echo "missing backend/serviceAccountKey.json"; exit 1; }
[ -d backend/node_modules ] || (cd backend && npm install)
[ -d frontend/node_modules ] || (cd frontend && npm install)

(cd backend && exec npm run dev) &
back=$!
(cd frontend && exec npm run dev) &
front=$!

# node --watch and npm each spawn a child that outlives the parent, so kill
# descendants first, then the two we started.
cleanup() { pkill -P "$back" 2>/dev/null; pkill -P "$front" 2>/dev/null; kill "$back" "$front" 2>/dev/null; }
trap cleanup EXIT INT TERM
echo "backend  -> http://localhost:8000"
echo "frontend -> http://localhost:5173"
wait

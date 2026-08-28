#!/usr/bin/env bash
# Start the API with reload. Override the port with: PORT=9000 ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] || { echo "no .venv — run: python -m venv .venv && .venv/bin/pip install -r requirements.txt"; exit 1; }
exec .venv/bin/uvicorn app.main:app --reload --port "${PORT:-8000}"

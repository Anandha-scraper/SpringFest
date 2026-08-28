#!/usr/bin/env bash
# Populate venues, events and staff roles. Safe to re-run.
# Pass through any seed.py flag, e.g. ./seed.sh --registrations 120
set -euo pipefail
cd "$(dirname "$0")"
exec .venv/bin/python seed.py "$@"

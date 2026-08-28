#!/usr/bin/env bash
# One-off: populate events and role assignments. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"
.venv/bin/python seed_events.py
.venv/bin/python seed_roles.py

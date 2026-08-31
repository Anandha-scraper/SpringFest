#!/usr/bin/env bash
#
# Create every App Hosting secret from the local .env files.
#
#   ./deploy/setup-secrets.sh                          # all secrets, API_ORIGIN placeholder
#   ./deploy/setup-secrets.sh --api-origin https://…   # fill in the real API URL
#   ./deploy/setup-secrets.sh --grant api-id,web-id    # grant both backends access
#   ./deploy/setup-secrets.sh --dry-run                # show what it would do, touch nothing
#
# Idempotent: re-running adds a new version of each secret rather than failing, so it is
# safe to run again after changing a value locally. Secret VALUES are never printed —
# only names and lengths — so this is safe to run with someone watching.
#
# The secret names are read from the two apphosting.yaml files rather than hardcoded, so
# adding a secret to a yaml and re-running this is all it takes; a name in a yaml with no
# matching local value is reported instead of silently skipped.
set -euo pipefail

cd "$(dirname "$0")/.."

API_ORIGIN_VALUE=""
GRANT_BACKENDS=""
PROJECT="${FIREBASE_PROJECT:-}"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --api-origin) API_ORIGIN_VALUE="${2:?--api-origin needs a URL}"; shift 2 ;;
    --grant)      GRANT_BACKENDS="${2:?--grant needs backend id(s)}"; shift 2 ;;
    --project)    PROJECT="${2:?--project needs an id}"; shift 2 ;;
    --dry-run)    DRY_RUN=1; shift ;;
    -h|--help)    awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# Default the project from the frontend env, which already names it.
if [ -z "$PROJECT" ]; then
  PROJECT="$(grep -m1 '^NEXT_PUBLIC_FIREBASE_PROJECT_ID=' web/.env.local | cut -d= -f2- || true)"
fi
[ -n "$PROJECT" ] || { echo "Could not determine the project id. Pass --project." >&2; exit 1; }

command -v firebase >/dev/null || { echo "firebase CLI not found." >&2; exit 1; }

echo "project: $PROJECT"
echo

# Read one KEY=value from a .env file, without sourcing it (a stray backtick or $ in a
# secret would otherwise be executed by the shell).
read_env() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 1
  local line
  line="$(grep -m1 "^${key}=" "$file" || true)"
  [ -n "$line" ] || return 1
  printf '%s' "${line#*=}"
}

# Where each secret's value comes from. Everything else in those files is deliberately
# absent: FIREBASE_CREDENTIALS is a local key-file path (App Hosting uses ADC instead),
# PAYMENT_KEY_ID is a plain non-secret value in backend/apphosting.yaml, and
# NEXT_PUBLIC_API_BASE defaults to "/api" in code.
source_file_for() {
  case "$1" in
    NEXT_PUBLIC_*) printf 'web/.env.local' ;;
    *)             printf 'backend/.env' ;;
  esac
}

declared_secrets() {
  grep -hoP '(?<=secret: ).*' backend/apphosting.yaml web/apphosting.yaml | sort -u
}

set_secret() {
  local name="$1" value="$2"
  if [ "$DRY_RUN" = 1 ]; then
    printf '  %-34s would set (%s chars)\n' "$name" "${#value}"
    return 0
  fi
  # --force: create if missing, grant the default permissions, don't prompt.
  # --data-file -: read the value from stdin so it never appears in the process list.
  if printf '%s' "$value" | firebase apphosting:secrets:set "$name" \
       --project "$PROJECT" --data-file - --force >/dev/null 2>&1; then
    printf '  %-34s ok (%s chars)\n' "$name" "${#value}"
  else
    printf '  %-34s FAILED\n' "$name"
    return 1
  fi
}

missing=0
failed=0

echo "secrets:"
for name in $(declared_secrets); do
  if [ "$name" = "API_ORIGIN" ]; then
    if [ -n "$API_ORIGIN_VALUE" ]; then
      set_secret "$name" "$API_ORIGIN_VALUE" || failed=1
    else
      # A placeholder rather than nothing: a backend whose yaml references a secret that
      # does not exist fails its rollout outright, and the API backend's URL cannot be
      # known until it has been created. Re-run with --api-origin once it exists.
      set_secret "$name" "https://example-set-me-after-backend-create.invalid" || failed=1
      printf '  %-34s ^ placeholder — re-run with --api-origin once the API backend exists\n' ""
    fi
    continue
  fi

  file="$(source_file_for "$name")"
  if value="$(read_env "$file" "$name")" && [ -n "$value" ]; then
    set_secret "$name" "$value" || failed=1
  else
    printf '  %-34s MISSING from %s\n' "$name" "$file"
    missing=1
  fi
done

if [ -n "$GRANT_BACKENDS" ]; then
  echo
  echo "granting access:"
  all="$(declared_secrets | paste -sd, -)"
  IFS=',' read -ra backends <<< "$GRANT_BACKENDS"
  for backend in "${backends[@]}"; do
    if [ "$DRY_RUN" = 1 ]; then
      printf '  %-34s would grant %s secrets\n' "$backend" "$(declared_secrets | wc -l)"
      continue
    fi
    if firebase apphosting:secrets:grantaccess "$all" \
         --project "$PROJECT" --backend "$backend" >/dev/null 2>&1; then
      printf '  %-34s ok\n' "$backend"
    else
      printf '  %-34s FAILED (does the backend exist yet?)\n' "$backend"
      failed=1
    fi
  done
fi

echo
if [ "$missing" = 1 ]; then
  echo "Some values were missing locally — fill them into the .env file named above and re-run."
fi
if [ "$failed" = 1 ]; then
  echo "Some operations failed. Re-run after fixing; this script is safe to repeat."
  exit 1
fi
if [ "$DRY_RUN" = 1 ]; then
  echo "Dry run — nothing was written. Re-run without --dry-run to apply."
else
  echo "Done. Next: DEPLOYMENT.md step 2 (create the API backend)."
fi

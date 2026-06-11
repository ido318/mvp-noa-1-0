#!/usr/bin/env bash
# Loads local Supabase env vars before running the given command.
# Strips quotes that `supabase status -o env` adds around values.
# Usage:
#   bash scripts/with-supabase-env.sh node scripts/seed-dev-user.mjs

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found in PATH." >&2
  exit 1
fi

# Grab the env block, strip the noisy `Stopped services` line and surrounding
# double quotes around values, then source it into this shell.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

supabase status -o env 2>/dev/null \
  | grep -E '^[A-Z_]+=' \
  | sed -E 's/^([A-Z_]+)="?(.*)"$/\1=\2/' \
  > "$TMP"

# shellcheck disable=SC1090
set -o allexport
. "$TMP"
set +o allexport

# Map Supabase status names → names our scripts expect.
export SUPABASE_URL="${API_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Error: SERVICE_ROLE_KEY not found in 'supabase status -o env' output." >&2
  echo "Is Supabase running? Try: supabase start" >&2
  exit 1
fi

echo "✓ SUPABASE_URL=$SUPABASE_URL"
echo "✓ SUPABASE_SERVICE_ROLE_KEY length=${#SUPABASE_SERVICE_ROLE_KEY}"

exec "$@"

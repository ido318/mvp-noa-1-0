#!/usr/bin/env bash
# Cloud Agent / local environment install: ensure the Supabase CLI is on PATH
# so `app/scripts/with-supabase-env.sh` (seed + integration tests) can run.
set -euo pipefail

if command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI already installed: $(command -v supabase)"
  supabase --version || true
  exit 0
fi

echo "Installing supabase CLI (npm -g supabase)..."
if ! npm i -g supabase; then
  echo "Error: failed to install supabase CLI." >&2
  echo "Install manually: npm i -g supabase" >&2
  echo "  or brew install supabase/tap/supabase" >&2
  echo "  See https://supabase.com/docs/guides/local-development/cli/getting-started" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI installed but not found in PATH." >&2
  exit 1
fi

supabase --version

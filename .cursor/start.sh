#!/usr/bin/env bash
# Cloud Agent start phase — per-boot runtime reconciliation.
# Brings up the Docker daemon and the local Supabase stack, writes local dev
# env files, and seeds demo data. Must be idempotent and must return (the agent
# and dashboard dev servers run as terminals, not here).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Docker daemon (no systemd in the Cloud Agent VM — start it directly).
# ─────────────────────────────────────────────────────────────────────────────
if ! docker info >/dev/null 2>&1; then
  echo "[start] Starting dockerd…"
  # This base image ships an iptables-legacy FORWARD chain with a DROP policy
  # and stale docker rules. With bridge-nf-call-iptables=1 that silently drops
  # container-to-container traffic (Supabase's Realtime/Postgres wiring). Docker
  # 29 manages the nft backend, so open the legacy FORWARD path explicitly.
  sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null || true
  sudo bash -c 'nohup dockerd --storage-driver=overlay2 >/var/log/dockerd.log 2>&1 &'

  echo "[start] Waiting for Docker to become ready…"
  for _ in $(seq 1 60); do
    if sudo docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi
# Make the socket usable by the current user without sudo (recreated each boot).
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

if ! docker info >/dev/null 2>&1; then
  echo "[start] ERROR: Docker daemon did not become ready." >&2
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Local Supabase stack (applies migrations + seed.sql on first start).
# ─────────────────────────────────────────────────────────────────────────────
if ! supabase status >/dev/null 2>&1; then
  echo "[start] Starting local Supabase…"
  supabase start
else
  echo "[start] Supabase already running."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Local dev env files (generated from `supabase status`; never committed).
# ─────────────────────────────────────────────────────────────────────────────
STATUS="$(supabase status -o env 2>/dev/null || true)"
getval() {
  echo "$STATUS" | grep -E "^$1=" | head -1 | sed -E "s/^$1=\"?(.*[^\"])\"?$/\1/"
}
API_URL="$(getval API_URL)";        API_URL="${API_URL:-http://127.0.0.1:54321}"
ANON_KEY="$(getval ANON_KEY)"
SERVICE_ROLE_KEY="$(getval SERVICE_ROLE_KEY)"

if [ ! -f app/.env.local ]; then
  echo "[start] Writing app/.env.local…"
  cat > app/.env.local <<EOF
APP_ENV=development
APP_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
DEV_USER_EMAIL=owner@noas-clinic.local
DEV_USER_PASSWORD=dev-password-change-me
GREEN_INVOICE_ENV=sandbox
RUN_INTEGRATION_TESTS=false
EOF
fi

if [ ! -f agent/.env ]; then
  echo "[start] Writing agent/.env…"
  cat > agent/.env <<EOF
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
PUBLIC_BASE_URL=http://localhost:3000
DEMO_MODE=true
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=local-dev-placeholder-token
TWILIO_PHONE_NUMBER=+972500000000
TWILIO_VALIDATE_SIGNATURE=false
ELEVENLABS_API_KEY=local-dev-placeholder
ELEVENLABS_AGENT_ID=local-dev-placeholder
ELEVENLABS_WEBHOOK_SECRET=local-dev-placeholder-webhook-secret
SUPABASE_URL=${API_URL}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
AGENT_CLINIC_ID=00000000-0000-4000-8000-000000000001
JOBS_BEARER_TOKEN=local-dev-jobs-bearer-token-0001
TOOLS_BEARER_TOKEN=local-dev-tools-bearer-token-0001
EOF
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. Seed dev user + demo data (idempotent — both scripts no-op if present).
# ─────────────────────────────────────────────────────────────────────────────
echo "[start] Seeding dev user + demo data…"
(cd app && npm run seed:all) || echo "[start] WARN: seeding failed (continuing)."

echo "[start] Ready. Agent → :3000, Dashboard → :3001, Supabase Studio → :54323"

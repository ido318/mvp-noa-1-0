#!/usr/bin/env bash
# Cloud Agent install phase — idempotent repository bootstrap.
# Durable, source-derived setup only. Per-boot runtime services (Docker daemon,
# Supabase stack, dev servers) are handled by .cursor/start.sh and terminals.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# System dependencies (idempotent — installed only when missing).
# These are normally already present in the environment's base snapshot; the
# guards make a fresh/default base image self-healing.
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "[install] Installing Docker…"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "[install] Installing Supabase CLI…"
  ARCH=amd64
  VER="$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
    | grep -oP '"tag_name":\s*"\K[^"]+')"
  curl -fsSL -o /tmp/supabase.deb \
    "https://github.com/supabase/cli/releases/download/${VER}/supabase_${VER#v}_linux_${ARCH}.deb"
  sudo dpkg -i /tmp/supabase.deb
fi

# Allow the current user to talk to the Docker socket without sudo.
sudo groupadd -f docker
sudo usermod -aG docker "$USER" || true

# ─────────────────────────────────────────────────────────────────────────────
# Node dependencies (npm workspaces) + shared package build.
# ─────────────────────────────────────────────────────────────────────────────
echo "[install] Installing npm workspace dependencies…"
npm install

echo "[install] Building @tomer/shared…"
npm run build --prefix packages/shared

echo "[install] Done."

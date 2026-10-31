#!/usr/bin/env bash
# Installs the admin console as a systemd user service that runs from its own
# clone of the repo, and publishes it on the tailnet with `tailscale serve`.
# Safe to re-run: it updates the unit and keeps an existing env file.
#
# Usage: admin/install-service.sh [--no-serve]
#   --no-serve  Skip the `tailscale serve` step.
#
# Settings (environment, defaults in brackets):
#   ADMIN_WORKSPACE  workspace clone          [~/isuzu-admin/workspace]
#   ADMIN_STATE_DIR  previews, thumbnails     [~/isuzu-admin/state]
#   ADMIN_REPO_URL   cloned if the workspace is missing
#                    [https://github.com/grossi/isuzu-artist-portfolio.git]
#   ADMIN_PORT / ADMIN_PREVIEW_PORT              local ports [8970 / 8972]
#   ADMIN_HTTPS_PORT / ADMIN_PREVIEW_HTTPS_PORT  tailnet HTTPS ports [8971 / 8973]
set -euo pipefail

serve=1
for arg in "$@"; do
  case "$arg" in
    --no-serve) serve="" ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

workspace="${ADMIN_WORKSPACE:-$HOME/isuzu-admin/workspace}"
state_dir="${ADMIN_STATE_DIR:-$HOME/isuzu-admin/state}"
repo_url="${ADMIN_REPO_URL:-https://github.com/grossi/isuzu-artist-portfolio.git}"
port="${ADMIN_PORT:-8970}"
preview_port="${ADMIN_PREVIEW_PORT:-8972}"
https_port="${ADMIN_HTTPS_PORT:-8971}"
preview_https_port="${ADMIN_PREVIEW_HTTPS_PORT:-8973}"
env_file="$HOME/.config/isuzu-admin/env"
unit_file="$HOME/.config/systemd/user/isuzu-admin.service"

# An existing env file wins (re-running must not point tailscale serve at
# other ports than the service uses).
from_env_file() {
  local value=""
  [ -f "$env_file" ] && value="$(sed -n "s/^$1=//p" "$env_file" | tail -n 1)"
  echo "${value:-$2}"
}
port="$(from_env_file ADMIN_PORT "$port")"
preview_port="$(from_env_file ADMIN_PREVIEW_PORT "$preview_port")"
workspace="$(from_env_file ADMIN_WORKSPACE "$workspace")"
state_dir="$(from_env_file ADMIN_STATE_DIR "$state_dir")"

# The unit file can't quote these paths.
for path in "$workspace" "$state_dir"; do
  case "$path" in
    *[!A-Za-z0-9._/-]*) echo "Use a path without spaces or special characters: $path" >&2; exit 1 ;;
  esac
done

node_bin="$(command -v node)" || { echo "node is not on PATH" >&2; exit 1; }
yarn_bin="$(command -v yarn)" || { echo "yarn is not on PATH" >&2; exit 1; }
aws_bin="$(command -v aws)" || { echo "aws (the AWS CLI, for yarn deploy) is not on PATH" >&2; exit 1; }

tailnet_name() {
  local name
  name="$(tailscale status --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log((JSON.parse(s).Self?.DNSName||"").replace(/\.$/,"")))')"
  if [ -z "$name" ]; then
    echo "Can't read this machine's tailnet name: is tailscale up and logged in?" >&2
    exit 1
  fi
  echo "$name"
}

echo "== Workspace $workspace"
if [ ! -d "$workspace/.git" ]; then
  mkdir -p "$(dirname "$workspace")"
  git clone --branch main "$repo_url" "$workspace"
fi
branch="$(git -C "$workspace" symbolic-ref --quiet --short HEAD || true)"
if [ "$branch" != "main" ]; then
  echo "$workspace is on '${branch:-detached HEAD}', not main" >&2
  exit 1
fi
if [ ! -f "$workspace/admin/server.js" ]; then
  echo "$workspace has no admin/ yet: is the admin console merged into main?" >&2
  exit 1
fi
(cd "$workspace" && "$yarn_bin" install --frozen-lockfile --non-interactive)
(cd "$workspace/admin" && "$yarn_bin" install --frozen-lockfile --non-interactive)
mkdir -p "$state_dir"

echo "== $env_file"
mkdir -p "$(dirname "$env_file")"
if [ -f "$env_file" ]; then
  echo "(kept the existing file)"
else
  name="$(tailnet_name)"
  cat > "$env_file" <<EOF
# isuzu-admin settings, read by $unit_file. Restart the service after editing:
#   systemctl --user restart isuzu-admin
ADMIN_WORKSPACE=$workspace
ADMIN_STATE_DIR=$state_dir
# Loopback only: tailscale serve publishes it on the tailnet over HTTPS.
ADMIN_HOST=127.0.0.1
ADMIN_PORT=$port
ADMIN_PREVIEW_PORT=$preview_port
ADMIN_TAILNET_NAME=$name
ADMIN_PREVIEW_URL=https://$name:$preview_https_port/
# Optional: only these Tailscale logins (comma-separated) may use the admin.
#ADMIN_ALLOWED_USERS=
# Split on spaces and run without a shell, in the workspace.
ADMIN_DEPLOY_CMD=yarn deploy
EOF
fi

echo "== $unit_file"
mkdir -p "$(dirname "$unit_file")"
cat > "$unit_file" <<EOF
[Unit]
Description=isuZu admin console (127.0.0.1:$port, preview :$preview_port; tailscale serve :$https_port / :$preview_https_port)

[Service]
Type=simple
WorkingDirectory=$workspace/admin
EnvironmentFile=$env_file
# yarn (corepack), node and aws (for yarn deploy).
Environment=PATH=$(dirname "$yarn_bin"):$(dirname "$node_bin"):$(dirname "$aws_bin"):/usr/local/bin:/usr/bin:/bin
ExecStart=$node_bin $workspace/admin/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable isuzu-admin.service
systemctl --user restart isuzu-admin.service

if [ "$(loginctl show-user "$USER" -p Linger --value)" != "yes" ]; then
  echo "Note: lingering is off, so the service stops when you log out. Enable it with:"
  echo "  sudo loginctl enable-linger $USER"
fi

if [ -n "$serve" ]; then
  echo "== tailscale serve (tailnet only, never funnel)"
  tailscale serve --bg --yes --https="$https_port" "http://127.0.0.1:$port"
  tailscale serve --bg --yes --https="$preview_https_port" "http://127.0.0.1:$preview_port"
fi

echo
if [ -n "$serve" ]; then
  name="$(tailnet_name)"
  echo "Admin:   https://$name:$https_port/"
  echo "Preview: https://$name:$preview_https_port/"
else
  echo "Admin:   http://127.0.0.1:$port/ (no tailscale serve)"
fi
echo "Logs:    journalctl --user -u isuzu-admin -f"

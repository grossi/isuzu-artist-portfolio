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

node_bin="$(command -v node)" || { echo "node is not on PATH" >&2; exit 1; }
yarn_bin="$(command -v yarn)" || { echo "yarn is not on PATH" >&2; exit 1; }
tailnet_name="$(tailscale status --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).Self.DNSName.replace(/\.$/,"")))')"

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
  cat > "$env_file" <<EOF
# isuzu-admin settings, read by $unit_file. Restart the service after editing:
#   systemctl --user restart isuzu-admin
ADMIN_WORKSPACE=$workspace
ADMIN_STATE_DIR=$state_dir
# Loopback only: tailscale serve publishes it on the tailnet over HTTPS.
ADMIN_HOST=127.0.0.1
ADMIN_PORT=$port
ADMIN_PREVIEW_PORT=$preview_port
ADMIN_TAILNET_NAME=$tailnet_name
ADMIN_PREVIEW_URL=https://$tailnet_name:$preview_https_port/
# Split on spaces and run without a shell, in the workspace.
ADMIN_DEPLOY_CMD=yarn deploy
EOF
fi

echo "== $unit_file"
mkdir -p "$(dirname "$unit_file")"
cat > "$unit_file" <<EOF
[Unit]
Description=isuZu admin console (127.0.0.1:$port, preview :$preview_port; tailscale serve :$https_port / :$preview_https_port)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$workspace/admin
EnvironmentFile=$env_file
# yarn (corepack) and aws live in ~/.local/bin.
Environment=PATH=$(dirname "$yarn_bin"):$(dirname "$node_bin"):/usr/local/bin:/usr/bin:/bin
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
echo "Admin:   https://$tailnet_name:$https_port/"
echo "Preview: https://$tailnet_name:$preview_https_port/"
echo "Logs:    journalctl --user -u isuzu-admin -f"

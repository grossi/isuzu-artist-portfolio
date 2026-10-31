import { homedir } from "node:os";
import { isIP } from "node:net";
import path from "node:path";

// Every setting comes from the environment (the systemd unit's EnvironmentFile).
export function loadConfig(env = process.env) {
  const home = homedir();
  const host = env.ADMIN_HOST || "127.0.0.1";
  assertPrivateHost(host);
  const tailnetName = env.ADMIN_TAILNET_NAME || "";
  return {
    workspace: path.resolve(env.ADMIN_WORKSPACE || path.join(home, "isuzu-admin/workspace")),
    stateDir: path.resolve(env.ADMIN_STATE_DIR || path.join(home, "isuzu-admin/state")),
    host,
    port: port(env.ADMIN_PORT, 8970),
    previewPort: port(env.ADMIN_PREVIEW_PORT, 8972),
    // Where the browser opens the preview; empty means "same host, preview port".
    previewUrl: env.ADMIN_PREVIEW_URL || "",
    // Host headers the admin answers to (DNS-rebinding guard); ports are ignored.
    allowedHosts: new Set(
      ["127.0.0.1", "localhost", "[::1]", host, tailnetName, ...(env.ADMIN_ALLOWED_HOSTS || "").split(",")]
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
    ),
    // Split on whitespace and run without a shell, e.g. "yarn deploy" or
    // "bash /tmp/stub-deploy.sh". It comes from the operator, never from a request.
    deployCommand: (env.ADMIN_DEPLOY_CMD || "yarn deploy").trim().split(/\s+/),
    remote: "origin",
    branch: "main",
    maxUploadBytes: 40 * 1024 * 1024,
    maxUploadFiles: 20,
  };
}

function port(value, fallback) {
  const number = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error(`Invalid port: ${value}`);
  return number;
}

// Loopback, or Tailscale's 100.64.0.0/10 and fd7a:115c:a1e0::/48 ranges. Never
// 0.0.0.0, a LAN or a public address.
export function assertPrivateHost(host) {
  if (host === "::1" || host === "localhost") return;
  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);
    if (a === 127 || (a === 100 && b >= 64 && b <= 127)) return;
  }
  if (isIP(host) === 6 && host.toLowerCase().startsWith("fd7a:115c:a1e0:")) return;
  throw new Error(`Refusing to listen on ${host}: use 127.0.0.1 (behind tailscale serve) or the tailnet IP`);
}

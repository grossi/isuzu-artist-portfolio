import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_LOG_LINES = 5000;

// One global lock: a build, save or deploy job, or a quick draft edit
// (upload, reorder, discard). Nothing waits for it; a second caller gets a 409.
export class Jobs {
  constructor() {
    this.holder = null; // { kind, job? }
    this.current = null; // running job
    this.last = null; // last finished job
    this.listeners = new Set();
  }

  busy() {
    return this.holder?.kind ?? null;
  }

  acquire(kind) {
    if (this.holder) throw new HttpError(409, `Busy: ${this.holder.kind} is running. Try again when it finishes.`);
    const holder = { kind };
    this.holder = holder;
    return () => {
      if (this.holder === holder) this.holder = null;
    };
  }

  // Quick operation under the lock, answered in the same request.
  async withLock(kind, fn) {
    const release = this.acquire(kind);
    try {
      return await fn();
    } finally {
      release();
      this.emit("state", {});
    }
  }

  // Long operation: takes the lock, returns at once, streams its log.
  start(kind, fn) {
    const release = this.acquire(kind);
    const job = { id: randomUUID(), kind, status: "running", startedAt: new Date().toISOString(), log: [] };
    this.current = job;
    const log = (line) => {
      for (const part of String(line).replace(/\r/g, "").split("\n")) {
        if (job.log.length >= MAX_LOG_LINES) job.log.splice(0, 1000, "… (earlier lines dropped)");
        job.log.push(part);
        this.emit("log", { id: job.id, line: part });
      }
    };
    this.emit("job", summary(job));
    (async () => {
      try {
        job.result = await fn(log);
        job.status = "succeeded";
      } catch (error) {
        job.status = "failed";
        job.error = error.message;
        log(`✗ ${error.message}`);
      } finally {
        job.finishedAt = new Date().toISOString();
        this.current = null;
        this.last = job;
        release();
        this.emit("job", summary(job));
        this.emit("state", {});
      }
    })();
    return summary(job);
  }

  job() {
    return this.current ?? this.last;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event, data) {
    for (const listener of this.listeners) listener(event, data);
  }
}

export function summary(job) {
  if (!job) return null;
  const { log, ...rest } = job;
  return { ...rest, lines: log.length };
}

// Runs a program without a shell, streaming its output to log. Rejects on a
// non-zero exit, or kills it after timeoutMs so a hung step can't hold the
// lock forever.
export function run(command, args, { cwd, log, env, timeoutMs = 30 * 60 * 1000 }) {
  log(`$ ${[command, ...args].join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      log(`✗ Still running after ${Math.round(timeoutMs / 60000)} min: stopping it`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10000).unref();
    }, timeoutMs);
    const pending = { stdout: "", stderr: "" };
    const forward = (stream) => (chunk) => {
      const text = pending[stream] + chunk.toString();
      const lines = text.split(/\r?\n/);
      pending[stream] = lines.pop();
      for (const line of lines) log(line);
    };
    child.stdout.on("data", forward("stdout"));
    child.stderr.on("data", forward("stderr"));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      for (const rest of Object.values(pending)) if (rest) log(rest);
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args[0] ?? ""} ${timedOut ? "timed out" : `failed (${signal ?? `exit code ${code}`})`}`));
    });
  });
}

import { setTimeout as sleep } from "node:timers/promises";
import type { EndOutcome, EndResult } from "../../domain/ports/process-table.js";

const WAIT_MS = 3_000;
const POLL_MS = 100;

function errorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}

/** Signal 0 checks that a process exists without touching it; EPERM means it exists but is not ours. */
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === "EPERM";
  }
}

function refusal(code: string | null): EndOutcome {
  if (code === "ESRCH") return "not-found";
  return code === "EPERM" ? "denied" : "failed";
}

/**
 * SIGTERM, or SIGKILL with `force`, then polling until each process is gone or a few
 * seconds pass. Node.js ends a Windows process at once for either signal.
 */
export async function endProcesses(pids: readonly number[], force: boolean): Promise<EndResult[]> {
  const results = new Map<number, EndResult>();
  for (const pid of pids) {
    try {
      process.kill(pid, force ? "SIGKILL" : "SIGTERM");
    } catch (error) {
      const code = errorCode(error);
      results.set(pid, { pid, outcome: refusal(code), code });
    }
  }
  const signalled = pids.filter((pid) => !results.has(pid));
  const deadline = Date.now() + WAIT_MS;
  let running = signalled.filter(isRunning);
  while (running.length > 0 && Date.now() < deadline) {
    await sleep(POLL_MS);
    running = running.filter(isRunning);
  }
  for (const pid of signalled) {
    results.set(pid, { pid, outcome: running.includes(pid) ? "still-running" : "ended", code: null });
  }
  return pids.map((pid) => results.get(pid) ?? { pid, outcome: "failed", code: null });
}

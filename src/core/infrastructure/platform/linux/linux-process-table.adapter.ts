import { readdir, readFile, readlink } from "node:fs/promises";
import path from "node:path";
import { CapabilityUnavailableError } from "../../../domain/errors.js";
import type { EndResult, ProcessInfo, ProcessListing, ProcessTable } from "../../../domain/ports/process-table.js";
import { endProcesses } from "../../node/process-signals.js";

const NUL = String.fromCharCode(0);

/** The name and parent id in /proc/<pid>/stat, where the name sits in parentheses and may hold spaces and parentheses. */
export function parseProcStat(stat: string): { readonly comm: string; readonly ppid: number } | null {
  const open = stat.indexOf("(");
  const close = stat.lastIndexOf(")");
  if (open < 0 || close < open) return null;
  const ppid = Number(stat.slice(close + 2).split(" ")[1]);
  return Number.isInteger(ppid) ? { comm: stat.slice(open + 1, close), ppid } : null;
}

/** VmRSS from /proc/<pid>/status in bytes; null for kernel threads, which have none. */
export function residentMemory(status: string): number | null {
  const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
  return match === null ? null : Number(match[1]) * 1024;
}

async function readProcess(pid: number): Promise<ProcessInfo | null> {
  const folder = `/proc/${pid}`;
  const stat = await readFile(`${folder}/stat`, "utf8").then(parseProcStat, () => null);
  // The process ended while the listing was read.
  if (stat === null) return null;
  const parts = (await readFile(`${folder}/cmdline`, "utf8").catch(() => "")).split(NUL).filter((part) => part !== "");
  // Programs may rename their main thread, as Node.js 24 does to MainThread, so the name comes from the executable.
  const executable = await readlink(`${folder}/exe`).catch(() => null);
  const program = parts[0];
  let name = stat.comm;
  if (executable !== null) name = path.posix.basename(executable.replace(/ \(deleted\)$/, ""));
  else if (program !== undefined) name = path.posix.basename(program);
  const memoryBytes = await readFile(`${folder}/status`, "utf8").then(residentMemory, () => null);
  return { pid, ppid: stat.ppid, name, command: parts.length > 0 ? parts.join(" ") : null, memoryBytes };
}

/** /proc read with node:fs: no program starts, and parent ids and command lines cost nothing extra. */
export class LinuxProcessTableAdapter implements ProcessTable {
  readonly selfPid = process.pid;

  async list(): Promise<ProcessListing> {
    let entries: string[];
    try {
      entries = await readdir("/proc");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new CapabilityUnavailableError("core.processes.unreadable", { source: "/proc", detail });
    }
    const pids = entries.filter((entry) => /^\d+$/.test(entry)).map(Number);
    const processes = (await Promise.all(pids.map(readProcess))).filter((entry) => entry !== null);
    return { processes, detailed: true };
  }

  end(pids: readonly number[], force: boolean): Promise<readonly EndResult[]> {
    return endProcesses(pids, force);
  }

  protectedPids(): ReadonlySet<number> {
    return new Set([0, 1, process.pid, process.ppid]);
  }
}

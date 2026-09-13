import path from "node:path";
import { CapabilityUnavailableError } from "../../../domain/errors.js";
import type { ProcessRunner } from "../../../domain/ports/process-runner.js";
import type { EndResult, ProcessInfo, ProcessListing, ProcessTable } from "../../../domain/ports/process-table.js";
import { endProcesses } from "../../node/process-signals.js";

export interface PsStat {
  readonly ppid: number;
  readonly memoryBytes: number;
  /** The executable's path, which may hold spaces. */
  readonly path: string;
}

/** `ps -axww -o pid=,ppid=,rss=,comm=`: comm comes last so its spaces survive; rss is in kilobytes. */
export function parsePsStats(output: string): Map<number, PsStat> {
  const stats = new Map<number, PsStat>();
  for (const line of output.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    if (match === null) continue;
    stats.set(Number(match[1]), { ppid: Number(match[2]), memoryBytes: Number(match[3]) * 1024, path: match[4] ?? "" });
  }
  return stats;
}

/** `ps -axww -o pid=,args=`: each process's command line. */
export function parsePsArgs(output: string): Map<number, string> {
  const commands = new Map<number, string>();
  for (const line of output.split("\n")) {
    const match = /^\s*(\d+)\s+(.*?)\s*$/.exec(line);
    if (match !== null && match[2] !== undefined && match[2] !== "") commands.set(Number(match[1]), match[2]);
  }
  return commands;
}

/** Two runs of ps, because a name and a command line can both hold spaces and ps separates columns with spaces. */
export class MacosProcessTableAdapter implements ProcessTable {
  readonly selfPid = process.pid;

  constructor(private readonly processRunner: ProcessRunner) {}

  async list(_detailed: boolean, signal: AbortSignal): Promise<ProcessListing> {
    const [stats, args] = await Promise.all([
      this.ps(["-axww", "-o", "pid=,ppid=,rss=,comm="], signal),
      this.ps(["-axww", "-o", "pid=,args="], signal),
    ]);
    const commands = parsePsArgs(args);
    const processes: ProcessInfo[] = [...parsePsStats(stats)].map(([pid, stat]) => ({
      pid,
      ppid: stat.ppid,
      name: path.posix.basename(stat.path),
      command: commands.get(pid) ?? null,
      memoryBytes: stat.memoryBytes,
    }));
    return { processes, detailed: true };
  }

  end(pids: readonly number[], force: boolean): Promise<readonly EndResult[]> {
    return endProcesses(pids, force);
  }

  protectedPids(): ReadonlySet<number> {
    return new Set([0, 1, process.pid, process.ppid]);
  }

  private async ps(args: readonly string[], signal: AbortSignal): Promise<string> {
    const result = await this.processRunner.run("/bin/ps", args, { signal, timeoutMs: 30_000 });
    if (result.code !== 0) {
      const detail = result.stderr.trim().split("\n")[0] ?? "";
      throw new CapabilityUnavailableError("core.processes.failed", { program: "ps", code: result.code, detail });
    }
    return result.stdout;
  }
}

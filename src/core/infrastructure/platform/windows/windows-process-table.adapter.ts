import { CapabilityUnavailableError, InterruptedError } from "../../../domain/errors.js";
import type { ProcessRunner } from "../../../domain/ports/process-runner.js";
import type { EndResult, ProcessInfo, ProcessListing, ProcessTable } from "../../../domain/ports/process-table.js";
import { endProcesses } from "../../node/process-signals.js";
import { runPowerShell, type ProgramResult } from "../../node/run-program.js";
import { system32 } from "./system32.js";

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** The fields of one CSV line, where a quoted field may hold commas. */
export function csvFields(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * `tasklist /fo csv /nh`: image name, PID, session name, session number, and memory
 * such as "45,120 K" in the machine's own number format, so only its digits are read.
 */
export function parseTasklist(output: string): ProcessInfo[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith('"'))
    .flatMap((line) => {
      const fields = csvFields(line);
      const pid = fields[1] ?? "";
      if (!/^\d+$/.test(pid)) return [];
      const digits = (fields[4] ?? "").replace(/\D/g, "");
      const memoryBytes = digits === "" ? null : Number(digits) * 1024;
      return [{ pid: Number(pid), ppid: null, name: fields[0] ?? "", command: null, memoryBytes }];
    });
}

interface CimRow {
  readonly pid?: unknown;
  readonly ppid?: unknown;
  readonly name?: unknown;
  readonly command?: unknown;
  readonly memory?: unknown;
}

/** The JSON the CIM script prints; null when it is not that JSON. */
export function parseCimProcesses(output: string): ProcessInfo[] | null {
  const text = output.trim();
  let rows: unknown;
  try {
    rows = JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  return rows.flatMap((row: unknown) => {
    if (typeof row !== "object" || row === null) return [];
    const value = row as CimRow;
    if (typeof value.pid !== "number") return [];
    return [
      {
        pid: value.pid,
        ppid: typeof value.ppid === "number" ? value.ppid : null,
        name: typeof value.name === "string" ? value.name : "",
        command: typeof value.command === "string" && value.command !== "" ? value.command : null,
        memoryBytes: typeof value.memory === "number" ? value.memory : null,
      },
    ];
  });
}

/** UTF-8 output fails harmlessly under Constrained Language Mode; the listing still works there. */
const CIM_SCRIPT = String.raw`
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$rows = @(Get-CimInstance -ClassName Win32_Process | ForEach-Object {
  [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId; name = $_.Name; command = $_.CommandLine; memory = $_.WorkingSetSize }
})
ConvertTo-Json -InputObject $rows -Compress
`;

function listingFailed(program: string, result: ProgramResult | { code: number; stderr: string }): Error {
  const detail = result.stderr.trim().split(/\r?\n/)[0] ?? "";
  return new CapabilityUnavailableError("core.processes.failed", { program, code: result.code, detail });
}

/**
 * Names and memory come from tasklist, measured at about 0.7 s. Parent ids and command
 * lines need Get-CimInstance through PowerShell, which takes a second or more; WMIC is gone
 * from current Windows. Verified on Windows Server 2025 in the phase 0 spike.
 */
export class WindowsProcessTableAdapter implements ProcessTable {
  readonly selfPid = process.pid;

  constructor(private readonly processRunner: ProcessRunner) {}

  async list(detailed: boolean, signal: AbortSignal): Promise<ProcessListing> {
    if (!detailed) return { processes: await this.fromTasklist(signal), detailed: false };
    return { processes: await this.fromCim(signal), detailed: true };
  }

  end(pids: readonly number[], force: boolean): Promise<readonly EndResult[]> {
    return endProcesses(pids, force);
  }

  protectedPids(): ReadonlySet<number> {
    // 0 is the System Idle Process and 4 the System process.
    return new Set([0, 4, process.pid, process.ppid]);
  }

  private async fromTasklist(signal: AbortSignal): Promise<ProcessInfo[]> {
    const result = await this.processRunner.run(system32("tasklist.exe"), ["/fo", "csv", "/nh"], {
      signal,
      timeoutMs: 60_000,
    });
    if (result.code !== 0) throw listingFailed("tasklist", result);
    return parseTasklist(result.stdout);
  }

  private async fromCim(signal: AbortSignal): Promise<ProcessInfo[]> {
    let result: ProgramResult;
    try {
      result = await runPowerShell(CIM_SCRIPT, { signal, timeoutMs: 120_000 });
    } catch (error) {
      if (signal.aborted) throw new InterruptedError("core.error.interrupted", {}, { cause: error });
      const detail = error instanceof Error ? error.message : String(error);
      throw new CapabilityUnavailableError("core.process.cannot-start", { program: "powershell.exe", detail });
    }
    const processes = result.code === 0 ? parseCimProcesses(result.stdout) : null;
    if (processes === null) throw listingFailed("Get-CimInstance", result);
    return processes;
  }
}

import { KiriyaError } from "../../../core/domain/errors.js";
import type { InputSchema } from "../../../core/domain/input-schema.js";
import type { RuntimeInfo } from "../../../core/domain/module.js";
import type { OsFamily } from "../../../core/domain/ports/environment.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import type { SystemSnapshot } from "../../../core/domain/ports/system-info.js";
import { TOOLS, toolVersion, type ToolDefinition } from "../domain/tools.js";

export type NoInput = Readonly<Record<string, never>>;

export const noInput: InputSchema<NoInput> = { positionals: [], options: {}, parse: () => ({}) };

export const SYS_COMMAND = { safety: "read", idempotent: true, usesNetwork: false, runsUserCommands: false } as const;

/** What a bug report may carry: nothing that names the machine or its owner. */
export interface MachineFacts {
  readonly os: OsFamily;
  readonly osName: string;
  readonly kernel: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpuCount: number;
  readonly memoryTotalBytes: number;
  readonly memoryFreeBytes: number;
  readonly locale: string;
  readonly timeZone: string;
  readonly node: string;
  readonly kiriya: string;
}

export function machineFacts(snapshot: SystemSnapshot, runtime: RuntimeInfo): MachineFacts {
  return {
    os: snapshot.os,
    osName: snapshot.osName,
    kernel: snapshot.kernel,
    arch: snapshot.arch,
    cpuModel: snapshot.cpuModel,
    cpuCount: snapshot.cpuCount,
    memoryTotalBytes: snapshot.memoryTotalBytes,
    memoryFreeBytes: snapshot.memoryFreeBytes,
    locale: snapshot.locale,
    timeZone: snapshot.timeZone,
    node: runtime.nodeVersion,
    kiriya: runtime.kiriyaVersion,
  };
}

export interface ToolReport {
  readonly name: string;
  /** null when the tool is not installed. */
  readonly version: string | null;
  readonly path: string | null;
}

const PROBE_TIMEOUT_MS = 15_000;

async function probe(runner: ProcessRunner, tool: ToolDefinition, signal: AbortSignal): Promise<ToolReport> {
  for (const program of tool.programs) {
    const found = await runner.find(program);
    if (found === null) continue;
    try {
      const result = await runner.run(found, tool.args, { timeoutMs: PROBE_TIMEOUT_MS, signal });
      const version = toolVersion(tool, `${result.stdout}\n${result.stderr}`);
      if (version !== null) return { name: tool.name, version, path: found };
    } catch (error) {
      if (!(error instanceof KiriyaError) || error.kind === "interrupted") throw error;
    }
  }
  return { name: tool.name, version: null, path: null };
}

/** Every known tool, looked for at the same time. */
export function findTools(runner: ProcessRunner, signal: AbortSignal): Promise<ToolReport[]> {
  return Promise.all(TOOLS.map((tool) => probe(runner, tool, signal)));
}

import { message, type Message } from "../domain/message.js";
import type { EndOutcome, EndResult } from "../domain/ports/process-table.js";

export interface EndedProcess {
  readonly pid: number;
  readonly name: string | null;
  readonly outcome: EndOutcome;
}

export interface EndReport {
  readonly processes: readonly EndedProcess[];
  readonly failures: readonly Message[];
  readonly warnings: readonly Message[];
}

/** "node (4100), node (4200)", to show in a confirmation what is about to end. */
export function processLabels(pids: readonly number[], names: ReadonlyMap<number, string>): string {
  return pids.map((pid) => `${names.get(pid) ?? "?"} (${pid})`).join(", ");
}

/** Ending results as output: a process already gone is a warning, and one that did not end is a failure. */
export function reportEnded(results: readonly EndResult[], names: ReadonlyMap<number, string>): EndReport {
  const failures: Message[] = [];
  const warnings: Message[] = [];
  for (const result of results) {
    const params = { name: names.get(result.pid) ?? "?", pid: result.pid, code: result.code ?? result.outcome };
    if (result.outcome === "not-found") warnings.push(message("core.end.gone", params));
    if (result.outcome === "still-running") failures.push(message("core.end.still-running", params));
    if (result.outcome === "denied") failures.push(message("core.end.denied", params));
    if (result.outcome === "failed") failures.push(message("core.end.failed", params));
  }
  const processes = results.map((result) => ({
    pid: result.pid,
    name: names.get(result.pid) ?? null,
    outcome: result.outcome,
  }));
  return { processes, failures, warnings };
}

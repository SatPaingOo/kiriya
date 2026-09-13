import { byCodePoint } from "../../../core/domain/names.js";
import type { ProcessInfo } from "../../../core/domain/ports/process-table.js";

/** A program name compared the same way everywhere: in lower case and without Windows' .exe. */
export function programKey(name: string): string {
  return name.toLowerCase().replace(/\.exe$/, "");
}

export function byNameThenPid(first: ProcessInfo, second: ProcessInfo): number {
  return byCodePoint(first.name.toLowerCase(), second.name.toLowerCase()) || first.pid - second.pid;
}

export interface TreeRow {
  readonly pid: number;
  readonly ppid: number | null;
  readonly name: string;
  /** 0 for a root. */
  readonly depth: number;
}

/**
 * Processes with each parent before its children, children by id. A process whose parent
 * is not listed is a root; parent ids that loop, as reused ids can make them, are walked once.
 */
export function processTree(processes: readonly ProcessInfo[], rootPid: number | null): TreeRow[] {
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  const children = new Map<number, ProcessInfo[]>();
  const roots: ProcessInfo[] = [];
  for (const entry of processes) {
    const parent = entry.ppid === null || entry.ppid === entry.pid ? undefined : byPid.get(entry.ppid);
    if (parent === undefined) {
      roots.push(entry);
    } else {
      children.set(parent.pid, [...(children.get(parent.pid) ?? []), entry]);
    }
  }

  const rows: TreeRow[] = [];
  const visited = new Set<number>();
  const walk = (start: ProcessInfo): void => {
    const stack: Array<readonly [ProcessInfo, number]> = [[start, 0]];
    for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
      const [entry, depth] = next;
      if (visited.has(entry.pid)) continue;
      visited.add(entry.pid);
      rows.push({ pid: entry.pid, ppid: entry.ppid, name: entry.name, depth });
      const kids = [...(children.get(entry.pid) ?? [])].sort((first, second) => second.pid - first.pid);
      for (const kid of kids) stack.push([kid, depth + 1]);
    }
  };

  if (rootPid !== null) {
    const root = byPid.get(rootPid);
    if (root !== undefined) walk(root);
    return rows;
  }
  const byId = (first: ProcessInfo, second: ProcessInfo): number => first.pid - second.pid;
  for (const root of [...roots].sort(byId)) walk(root);
  for (const entry of [...processes].sort(byId)) if (!visited.has(entry.pid)) walk(entry);
  return rows;
}

import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import { columns, endedLines } from "../../../core/presentation/ended-processes.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import type { KillOutput } from "../application/end-processes.use-case.js";
import type { ProcessesOutput } from "../application/list-processes.use-case.js";
import type { TreeOutput } from "../application/show-tree.use-case.js";

/** Id, memory and name; with details also the parent id and, last, the command line. */
export const processesView: TextView<ProcessesOutput> = (output, format) => {
  if (output.processes.length === 0) return [];
  const label = (key: MessageKey): string => format.text(message(key));
  const detailed = output.detailed;
  const header = [
    label("proc.column.pid"),
    ...(detailed ? [label("proc.column.parent")] : []),
    label("proc.column.memory"),
    label("proc.column.name"),
    ...(detailed ? [label("proc.column.command")] : []),
  ];
  const rows = output.processes.map((entry) => [
    String(entry.pid),
    ...(detailed ? [entry.ppid === null ? "" : String(entry.ppid)] : []),
    entry.memoryBytes === null ? "" : format.bytes(entry.memoryBytes),
    entry.name,
    ...(detailed ? [entry.command ?? ""] : []),
  ]);
  const [first = "", ...rest] = columns([header, ...rows]);
  return [format.bold(first), ...rest];
};

export const killView: TextView<KillOutput> = (output, format) => endedLines(output.processes, format);

export const treeView: TextView<TreeOutput> = (output, format) =>
  output.rows.map((row) => `${"  ".repeat(row.depth)}${row.name} ${format.dim(String(row.pid))}`);

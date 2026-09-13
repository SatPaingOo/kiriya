import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import { columns, endedLines } from "../../../core/presentation/ended-processes.js";
import type { KillPortOutput } from "../application/end-port-owners.use-case.js";
import type { FreeOutput } from "../application/find-free-port.use-case.js";
import type { WhoOutput } from "../application/find-listeners.use-case.js";

export const whoView: TextView<WhoOutput> = (output, format) => {
  if (output.listeners.length === 0) {
    const empty =
      output.port === null ? message("port.who.none-at-all") : message("port.who.none", { port: output.port });
    return [format.dim(format.text(empty))];
  }
  const hidden = format.text(message("port.who.hidden"));
  const header = [
    format.text(message("port.column.port")),
    format.text(message("port.column.address")),
    format.text(message("port.column.pid")),
    format.text(message("port.column.process")),
  ];
  const rows = output.listeners.map((listener) => [
    String(listener.port),
    listener.address,
    listener.pid === null ? "" : String(listener.pid),
    listener.name ?? (listener.pid === null ? hidden : ""),
  ]);
  const [first = "", ...rest] = columns([header, ...rows]);
  return [format.bold(first), ...rest];
};

export const killView: TextView<KillPortOutput> = (output, format) => endedLines(output.processes, format);

/** The number alone, so `$(kiriya port free)` works in a script. */
export const freeView: TextView<FreeOutput> = (output) => [String(output.port)];

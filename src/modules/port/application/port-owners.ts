import { UsageError } from "../../../core/domain/errors.js";
import { byCodePoint } from "../../../core/domain/names.js";
import type { Listener, PortTable } from "../../../core/domain/ports/port-table.js";
import type { ProcessTable } from "../../../core/domain/ports/process-table.js";
import { parsePort } from "../domain/port-number.js";

export interface OwnedListener extends Listener {
  /** The owner's program name; null when the owner is hidden or ended meanwhile. */
  readonly name: string | null;
}

export function readPort(text: string): number {
  const port = parsePort(text);
  if (port === null) throw new UsageError("port.invalid", { port: text });
  return port;
}

/** Listeners on one port, or on all when `port` is null, with their owners' names, sorted by port, address and id. */
export async function ownedListeners(
  ports: PortTable,
  processes: ProcessTable,
  port: number | null,
  signal: AbortSignal,
): Promise<OwnedListener[]> {
  const listeners = (await ports.listeners(signal)).filter((listener) => port === null || listener.port === port);
  const names = new Map<number, string>();
  if (listeners.some((listener) => listener.pid !== null)) {
    for (const entry of (await processes.list(false, signal)).processes) names.set(entry.pid, entry.name);
  }
  const unique = new Map<string, OwnedListener>();
  for (const listener of listeners) {
    const name = listener.pid === null ? null : (names.get(listener.pid) ?? null);
    unique.set(`${listener.port}|${listener.address}|${listener.pid ?? ""}`, { ...listener, name });
  }
  return [...unique.values()].sort(
    (first, second) =>
      first.port - second.port || byCodePoint(first.address, second.address) || (first.pid ?? -1) - (second.pid ?? -1),
  );
}

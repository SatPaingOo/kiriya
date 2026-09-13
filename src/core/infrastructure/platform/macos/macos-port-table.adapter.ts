import { CapabilityUnavailableError } from "../../../domain/errors.js";
import type { Listener, PortTable } from "../../../domain/ports/port-table.js";
import type { ProcessRunner } from "../../../domain/ports/process-runner.js";
import { canListen } from "../../node/can-listen.js";

/** `netstat -an -p tcp`: every listening socket, with the port after the address's last dot and * for any address. */
export function parseMacosNetstat(output: string): Listener[] {
  const listeners: Listener[] = [];
  for (const line of output.split("\n")) {
    const parts = line.trim().split(/\s+/);
    const protocol = parts[0] ?? "";
    if (parts.length < 6 || !protocol.startsWith("tcp") || parts[5] !== "LISTEN") continue;
    const local = parts[3] ?? "";
    const dot = local.lastIndexOf(".");
    const port = Number(local.slice(dot + 1));
    if (dot < 0 || !Number.isInteger(port)) continue;
    const host = local.slice(0, dot);
    const address = host === "*" ? (protocol === "tcp4" ? "0.0.0.0" : "::") : host;
    listeners.push({ address, port, pid: null });
  }
  return listeners;
}

export interface OwnedSocket {
  readonly pid: number;
  readonly address: string;
  readonly port: number;
}

/** `lsof -nP -iTCP -sTCP:LISTEN -Fpn`: a p line names the process, and each n line after it a socket. */
export function parseLsofListeners(output: string): OwnedSocket[] {
  const sockets: OwnedSocket[] = [];
  let pid: number | null = null;
  for (const line of output.split("\n").map((text) => text.trim())) {
    if (line.startsWith("p")) {
      pid = Number(line.slice(1));
    } else if (line.startsWith("n") && pid !== null) {
      const match = /^n(.*):(\d+)$/.exec(line);
      if (match === null) continue;
      sockets.push({ pid, address: (match[1] ?? "").replace(/^\[(.*)\]$/, "$1"), port: Number(match[2]) });
    }
  }
  return sockets;
}

const ANY_ADDRESS: ReadonlySet<string> = new Set(["*", "0.0.0.0", "::"]);

/**
 * netstat sees every listener but no owner; lsof sees owners, but without root only the
 * user's own. Each listener takes its owners from lsof, and a socket only lsof saw is kept.
 */
export function mergeListeners(all: readonly Listener[], owned: readonly OwnedSocket[]): Listener[] {
  const used = new Set<OwnedSocket>();
  const merged: Listener[] = [];
  for (const listener of all) {
    const owners = owned.filter(
      (socket) =>
        socket.port === listener.port &&
        (socket.address === listener.address || (ANY_ADDRESS.has(socket.address) && ANY_ADDRESS.has(listener.address))),
    );
    if (owners.length === 0) merged.push(listener);
    for (const owner of owners) {
      used.add(owner);
      merged.push({ ...listener, pid: owner.pid });
    }
  }
  for (const socket of owned) {
    if (used.has(socket)) continue;
    merged.push({ address: socket.address === "*" ? "0.0.0.0" : socket.address, port: socket.port, pid: socket.pid });
  }
  return merged;
}

export class MacosPortTableAdapter implements PortTable {
  constructor(private readonly processRunner: ProcessRunner) {}

  async listeners(signal: AbortSignal): Promise<readonly Listener[]> {
    const options = { signal, timeoutMs: 30_000 };
    const [netstat, lsof] = await Promise.all([
      this.processRunner.run("/usr/sbin/netstat", ["-an", "-p", "tcp"], options),
      this.processRunner.run("/usr/sbin/lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"], options),
    ]);
    // lsof exits 1 when it finds none of the user's sockets.
    if (netstat.code !== 0 && lsof.code > 1) {
      const detail = netstat.stderr.trim().split("\n")[0] ?? "";
      throw new CapabilityUnavailableError("core.ports.failed", { program: "netstat", code: netstat.code, detail });
    }
    return mergeListeners(netstat.code === 0 ? parseMacosNetstat(netstat.stdout) : [], parseLsofListeners(lsof.stdout));
  }

  canListen(port: number): Promise<boolean> {
    return canListen(port);
  }
}

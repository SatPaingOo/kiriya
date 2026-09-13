import { readdir, readFile, readlink } from "node:fs/promises";
import { CapabilityUnavailableError } from "../../../domain/errors.js";
import type { Listener, PortTable } from "../../../domain/ports/port-table.js";
import { canListen } from "../../node/can-listen.js";

function compressIpv6(groups: readonly string[]): string {
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== "0") {
      index += 1;
      continue;
    }
    let end = index;
    while (end < groups.length && groups[end] === "0") end += 1;
    if (end - index >= 2 && end - index > bestLength) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end;
  }
  if (bestStart < 0) return groups.join(":");
  return `${groups.slice(0, bestStart).join(":")}::${groups.slice(bestStart + bestLength).join(":")}`;
}

/** A hexadecimal address from /proc/net/tcp: IPv4 as one little-endian 32-bit word, IPv6 as four. */
export function decodeProcAddress(hex: string): string {
  const pairs = (word: string): string[] => word.match(/../g) ?? [];
  if (hex.length === 8) {
    return pairs(hex)
      .reverse()
      .map((byte) => parseInt(byte, 16))
      .join(".");
  }
  if (hex.length !== 32) return hex;
  const bytes = (hex.match(/.{8}/g) ?? []).flatMap((word) => pairs(word).reverse());
  const groups: string[] = [];
  for (let index = 0; index < bytes.length; index += 2) {
    groups.push(parseInt(`${bytes[index] ?? "00"}${bytes[index + 1] ?? "00"}`, 16).toString(16));
  }
  return compressIpv6(groups);
}

export interface ProcSocket {
  readonly address: string;
  readonly port: number;
  readonly inode: string;
}

/** Listening sockets from /proc/net/tcp or tcp6: state 0A is LISTEN, and the inode names the socket. */
export function parseProcNetTcp(text: string): ProcSocket[] {
  return text
    .split("\n")
    .slice(1)
    .flatMap((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10 || parts[3] !== "0A") return [];
      const [address = "", port = ""] = (parts[1] ?? "").split(":");
      return [{ address: decodeProcAddress(address), port: parseInt(port, 16), inode: parts[9] ?? "" }];
    });
}

/** Socket inodes and the processes holding them, from every /proc/<pid>/fd this user may read. */
async function socketOwners(): Promise<Map<string, number>> {
  const owners = new Map<string, number>();
  const pids = (await readdir("/proc")).filter((entry) => /^\d+$/.test(entry));
  for (const pid of pids) {
    const descriptors = await readdir(`/proc/${pid}/fd`).catch(() => []);
    const links = await Promise.all(
      descriptors.map((descriptor) => readlink(`/proc/${pid}/fd/${descriptor}`).catch(() => "")),
    );
    for (const link of links) {
      if (link.startsWith("socket:[")) owners.set(link.slice(8, -1), Number(pid));
    }
  }
  return owners;
}

/**
 * /proc/net/tcp and tcp6 read with node:fs. Another user's socket has no visible owner
 * without elevation, because /proc/<pid>/fd needs ptrace access; kiriya never elevates.
 */
export class LinuxPortTableAdapter implements PortTable {
  async listeners(): Promise<readonly Listener[]> {
    const reads = await Promise.allSettled(["/proc/net/tcp", "/proc/net/tcp6"].map((file) => readFile(file, "utf8")));
    const texts = reads.flatMap((read) => (read.status === "fulfilled" ? [read.value] : []));
    const firstFailure = reads.find((read) => read.status === "rejected");
    if (texts.length === 0 && firstFailure !== undefined) {
      const detail = firstFailure.reason instanceof Error ? firstFailure.reason.message : String(firstFailure.reason);
      throw new CapabilityUnavailableError("core.ports.unreadable", { source: "/proc/net/tcp", detail });
    }
    const sockets = texts.flatMap(parseProcNetTcp);
    if (sockets.length === 0) return [];
    const owners = await socketOwners();
    return sockets.map((socket) => ({
      address: socket.address,
      port: socket.port,
      pid: owners.get(socket.inode) ?? null,
    }));
  }

  canListen(port: number): Promise<boolean> {
    return canListen(port);
  }
}

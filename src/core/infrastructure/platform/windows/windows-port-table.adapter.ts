import { CapabilityUnavailableError } from "../../../domain/errors.js";
import type { Listener, PortTable } from "../../../domain/ports/port-table.js";
import type { ProcessRunner } from "../../../domain/ports/process-runner.js";
import { canListen } from "../../node/can-listen.js";
import { system32 } from "./system32.js";

const LINE = /^\s*TCP\s+(\S+):(\d+)\s+(\S+):(\d+)\s+\S+\s+(\d+)\s*$/;

/**
 * `netstat -ano`. The state column is translated on Windows in other languages, so a
 * listener is recognised by its foreign port of 0 rather than by the word LISTENING.
 */
export function parseWindowsNetstat(output: string): Listener[] {
  const listeners: Listener[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = LINE.exec(line);
    if (match === null || match[4] !== "0") continue;
    const address = (match[1] ?? "").replace(/^\[(.*)\]$/, "$1");
    listeners.push({ address, port: Number(match[2]), pid: Number(match[5]) });
  }
  return listeners;
}

/** netstat shows owners without elevation and took about 30 ms in measurements. */
export class WindowsPortTableAdapter implements PortTable {
  constructor(private readonly processRunner: ProcessRunner) {}

  async listeners(signal: AbortSignal): Promise<readonly Listener[]> {
    const result = await this.processRunner.run(system32("netstat.exe"), ["-ano"], { signal, timeoutMs: 60_000 });
    if (result.code !== 0) {
      const detail = result.stderr.trim().split(/\r?\n/)[0] ?? "";
      throw new CapabilityUnavailableError("core.ports.failed", { program: "netstat", code: result.code, detail });
    }
    return parseWindowsNetstat(result.stdout);
  }

  canListen(port: number): Promise<boolean> {
    return canListen(port);
  }
}

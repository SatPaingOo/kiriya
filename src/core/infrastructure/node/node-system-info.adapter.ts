import { readFile } from "node:fs/promises";
import os from "node:os";
import type { Environment } from "../../domain/ports/environment.js";
import type { ProcessRunner } from "../../domain/ports/process-runner.js";
import type { SystemInfo, SystemSnapshot } from "../../domain/ports/system-info.js";

/** PRETTY_NAME from the text of an os-release file, or null. */
export function prettyNameFromOsRelease(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const match = /^PRETTY_NAME=(.*)$/.exec(line.trim());
    if (match === null) continue;
    const value = (match[1] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
    return value === "" ? null : value;
  }
  return null;
}

/** Windows 11 still names itself Windows 10 where Node.js reads the name; its builds start at 22000. */
export function windowsName(version: string, release: string): string {
  const build = Number(release.split(".")[2] ?? "0");
  return build >= 22000 ? version.replace(/^Windows 10\b/, "Windows 11") : version;
}

export class NodeSystemInfoAdapter implements SystemInfo {
  constructor(
    private readonly environment: Environment,
    private readonly processRunner: ProcessRunner,
  ) {}

  async read(): Promise<SystemSnapshot> {
    const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();
    return {
      os: this.environment.os,
      osName: await this.osName(),
      kernel: os.release(),
      arch: os.arch(),
      cpuModel: os.cpus()[0]?.model.trim() ?? "",
      cpuCount: os.availableParallelism(),
      memoryTotalBytes: os.totalmem(),
      memoryFreeBytes: os.freemem(),
      uptimeSeconds: Math.floor(os.uptime()),
      hostname: os.hostname(),
      locale,
      timeZone,
    };
  }

  private async osName(): Promise<string> {
    switch (this.environment.os) {
      case "windows":
        return windowsName(os.version(), os.release());
      case "linux":
        for (const file of ["/etc/os-release", "/usr/lib/os-release"]) {
          const name = await readFile(file, "utf8").then(prettyNameFromOsRelease, () => null);
          if (name !== null) return name;
        }
        return "Linux";
      case "macos": {
        const version = await this.processRunner
          .run("/usr/bin/sw_vers", ["-productVersion"], { timeoutMs: 10_000 })
          .then(
            (result) => (result.code === 0 ? result.stdout.trim() : ""),
            () => "",
          );
        return version === "" ? "macOS" : `macOS ${version}`;
      }
    }
  }
}

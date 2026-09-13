import type { OsFamily } from "./environment.js";

export interface SystemSnapshot {
  readonly os: OsFamily;
  /** The product name, such as "Windows 11 Pro", "Ubuntu 24.04.1 LTS" or "macOS 15.2". */
  readonly osName: string;
  /** The kernel release, such as "10.0.26100" or "6.8.0-45-generic". */
  readonly kernel: string;
  readonly arch: string;
  readonly cpuModel: string;
  /** Logical processors Node.js can use. */
  readonly cpuCount: number;
  readonly memoryTotalBytes: number;
  readonly memoryFreeBytes: number;
  readonly uptimeSeconds: number;
  readonly hostname: string;
  readonly locale: string;
  readonly timeZone: string;
}

/** Facts about this machine, each read the way its OS provides it. */
export interface SystemInfo {
  read(): Promise<SystemSnapshot>;
}

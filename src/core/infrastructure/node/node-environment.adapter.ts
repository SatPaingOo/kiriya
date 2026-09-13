import { homedir } from "node:os";
import type { Environment, OsFamily } from "../../domain/ports/environment.js";

function osFamily(platform: NodeJS.Platform): OsFamily {
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  // Other Unix-like systems follow the Linux adapters until they get their own.
  return "linux";
}

export class NodeEnvironmentAdapter implements Environment {
  readonly os: OsFamily = osFamily(process.platform);
  readonly homeDirectory = homedir();

  variable(name: string): string | undefined {
    return process.env[name];
  }

  variables(): Readonly<Record<string, string>> {
    const entries = Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined);
    return Object.fromEntries(entries);
  }
}

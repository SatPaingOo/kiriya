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

  /**
   * Own entries only. `process.env` answers `constructor` and the rest of `Object.prototype`
   * with a function, which is not a variable and is not a string either, so `env path
   * constructor` would reach code expecting text and throw.
   */
  variable(name: string): string | undefined {
    return Object.hasOwn(process.env, name) ? process.env[name] : undefined;
  }

  variables(): Readonly<Record<string, string>> {
    const entries = Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined);
    return Object.fromEntries(entries);
  }
}

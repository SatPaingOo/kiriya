import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAIN = fileURLToPath(new URL("../../src/main.js", import.meta.url));

export interface CliRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * The built CLI as a black box, with no terminal on stdin. Colour is off unless the
 * environment given turns it on; FORCE_COLOR from the outside never leaks in.
 */
export function runKiriya(
  cwd: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = { KIRIYA_NO_COLOR: "1" },
): CliRun {
  const env: NodeJS.ProcessEnv = { ...process.env, ...environment };
  if (environment["FORCE_COLOR"] === undefined) delete env["FORCE_COLOR"];
  const run = spawnSync(process.execPath, [MAIN, ...args], { cwd, encoding: "utf8", env });
  return { code: run.status, stdout: run.stdout, stderr: run.stderr };
}

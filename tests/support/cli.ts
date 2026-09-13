import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = fileURLToPath(new URL("../../src/main.js", import.meta.url));

/** A configuration file that never exists, so a developer's own plugins and settings never reach a test. */
const NO_CONFIG = path.join(tmpdir(), "kiriya-tests", "no-config.json");

export interface CliRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * The built CLI as a black box, with no terminal on stdin: `input` is piped in, or
 * stdin is empty. Colour is off unless the environment given turns it on; FORCE_COLOR
 * from the outside never leaks in, and the configuration file is an empty one unless
 * the environment names another.
 */
export function runKiriya(
  cwd: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = { KIRIYA_NO_COLOR: "1" },
  input = "",
): CliRun {
  const env: NodeJS.ProcessEnv = { ...process.env, KIRIYA_CONFIG: NO_CONFIG, ...environment };
  if (environment["FORCE_COLOR"] === undefined) delete env["FORCE_COLOR"];
  const run = spawnSync(process.execPath, [MAIN, ...args], { cwd, encoding: "utf8", env, input });
  return { code: run.status, stdout: run.stdout, stderr: run.stderr };
}

import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = fileURLToPath(new URL("../../src/main.js", import.meta.url));

/** A configuration file that never exists, so a developer's own plugins and settings never reach a test. */
const NO_CONFIG = path.join(tmpdir(), "kiriya-tests", "no-config.json");

const PLAIN: Readonly<Record<string, string>> = { KIRIYA_NO_COLOR: "1" };

export interface CliRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Colour is off unless the environment given turns it on; FORCE_COLOR from the outside
 * never leaks in, and the configuration file is an empty one unless the environment names another.
 */
function cliEnvironment(environment: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, KIRIYA_CONFIG: NO_CONFIG, ...environment };
  if (environment["FORCE_COLOR"] === undefined) delete env["FORCE_COLOR"];
  return env;
}

/** The built CLI as a black box, with no terminal on stdin: `input` is piped in, or stdin is empty. */
export function runKiriya(
  cwd: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = PLAIN,
  input = "",
): CliRun {
  const env = cliEnvironment(environment);
  const run = spawnSync(process.execPath, [MAIN, ...args], { cwd, encoding: "utf8", env, input });
  return { code: run.status, stdout: run.stdout, stderr: run.stderr };
}

/**
 * The same without blocking this process while kiriya runs. A test needs it when kiriya
 * ends a process the test started: an ended child is gone only once its running parent collects it.
 */
export function runKiriyaAsync(
  cwd: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = PLAIN,
): Promise<CliRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MAIN, ...args], { cwd, env: cliEnvironment(environment) });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end();
  });
}

/** The built CLI with a pipe on each stream, for a test that talks to it while it runs, such as an MCP client. */
export function startKiriya(
  cwd: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = PLAIN,
): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [MAIN, ...args], { cwd, env: cliEnvironment(environment) });
}

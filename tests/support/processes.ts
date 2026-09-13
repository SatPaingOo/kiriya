import { spawn, type ChildProcess } from "node:child_process";
import type { TestContext } from "node:test";

export interface StartedProcess {
  readonly child: ChildProcess;
  readonly pid: number;
}

/** A Node.js process listening on a free TCP port on every interface, ended when the test ends. */
export async function startListener(t: TestContext): Promise<StartedProcess & { readonly port: number }> {
  const script =
    "const s = require('node:net').createServer(); s.listen(0, () => console.log(s.address().port)); setInterval(() => {}, 1000);";
  const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "inherit"], windowsHide: true });
  t.after(() => {
    child.kill();
  });
  const port = await new Promise<number>((resolve, reject) => {
    child.stdout?.once("data", (data: Buffer) => resolve(Number(String(data).trim())));
    child.once("exit", (code) => reject(new Error(`the listener exited with code ${String(code)}`)));
  });
  return { child, pid: child.pid ?? -1, port };
}

/** A Node.js process that only waits, with `marker` on its command line, ended when the test ends. */
export async function startMarker(t: TestContext, marker: string): Promise<StartedProcess> {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", marker], {
    stdio: "ignore",
    windowsHide: true,
  });
  t.after(() => {
    child.kill();
  });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", () => resolve());
    child.once("error", reject);
  });
  return { child, pid: child.pid ?? -1 };
}

/** Resolves once the process has exited; at once when it already has. */
export function exited(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", () => resolve()));
}

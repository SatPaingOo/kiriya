import assert from "node:assert/strict";
import { test } from "node:test";
import type { PortTable } from "../../../src/core/domain/ports/port-table.js";
import type { ProcessTable } from "../../../src/core/domain/ports/process-table.js";
import { NodeProcessRunnerAdapter } from "../../../src/core/infrastructure/node/node-process-runner.adapter.js";
import { LinuxPortTableAdapter } from "../../../src/core/infrastructure/platform/linux/linux-port-table.adapter.js";
import { LinuxProcessTableAdapter } from "../../../src/core/infrastructure/platform/linux/linux-process-table.adapter.js";
import { MacosPortTableAdapter } from "../../../src/core/infrastructure/platform/macos/macos-port-table.adapter.js";
import { MacosProcessTableAdapter } from "../../../src/core/infrastructure/platform/macos/macos-process-table.adapter.js";
import { WindowsPortTableAdapter } from "../../../src/core/infrastructure/platform/windows/windows-port-table.adapter.js";
import { WindowsProcessTableAdapter } from "../../../src/core/infrastructure/platform/windows/windows-process-table.adapter.js";
import { exited, startListener, startMarker } from "../../support/processes.js";

/** The adapters for the OS the tests run on, as main.ts chooses them. */
function tables(): { readonly processes: ProcessTable; readonly ports: PortTable } {
  const runner = new NodeProcessRunnerAdapter();
  if (process.platform === "win32") {
    return { processes: new WindowsProcessTableAdapter(runner), ports: new WindowsPortTableAdapter(runner) };
  }
  if (process.platform === "darwin") {
    return { processes: new MacosProcessTableAdapter(runner), ports: new MacosPortTableAdapter(runner) };
  }
  return { processes: new LinuxProcessTableAdapter(), ports: new LinuxPortTableAdapter() };
}

const signal = (): AbortSignal => new AbortController().signal;

test("the process table lists this process, and details show a child's parent and command line", async (t) => {
  const { processes } = tables();
  const basic = await processes.list(false, signal());
  const self = basic.processes.find((entry) => entry.pid === process.pid);
  assert.ok(self, "this process is missing");
  assert.match(self.name, /node/i);
  assert.equal(processes.selfPid, process.pid);
  assert.ok(processes.protectedPids().has(process.pid));

  const marker = `kiriya-table-marker-${process.pid}`;
  const { pid } = await startMarker(t, marker);
  const detailed = await processes.list(true, signal());
  assert.equal(detailed.detailed, true);
  const found = detailed.processes.find((entry) => entry.pid === pid);
  assert.ok(found, `pid ${pid} is missing`);
  assert.equal(found.ppid, process.pid);
  assert.ok(found.command?.includes(marker), found.command ?? "no command line");
});

test("the port table finds a listener's owner, and ending the owner frees its port", async (t) => {
  const { processes, ports } = tables();
  const { child, pid, port } = await startListener(t);
  const listeners = (await ports.listeners(signal())).filter((listener) => listener.port === port);
  assert.ok(
    listeners.some((listener) => listener.pid === pid),
    JSON.stringify(listeners),
  );
  assert.equal(await ports.canListen(port), false);

  const gone = exited(child);
  const results = await processes.end([pid], false);
  assert.deepEqual(
    results.map((result) => result.outcome),
    ["ended"],
  );
  await gone;
  assert.equal(await ports.canListen(port), true);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { KiriyaError, NotFoundError, RefusedError, UsageError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import { EndProcesses, killSpec } from "../../../src/modules/proc/application/end-processes.use-case.js";
import { FindProcesses, findSpec } from "../../../src/modules/proc/application/find-processes.use-case.js";
import { ListProcesses, listSpec } from "../../../src/modules/proc/application/list-processes.use-case.js";
import { ShowTree, treeSpec } from "../../../src/modules/proc/application/show-tree.use-case.js";
import { processTree } from "../../../src/modules/proc/domain/process-tree.js";
import { commandContext, expectDone, FakeProcessTable, processInfo } from "../../support/fakes.js";

const raw = (positionals: readonly string[], options: RawInput["options"] = {}): RawInput => ({ positionals, options });
const failsWith = (type: new (...args: never[]) => KiriyaError, key: string) => (error: unknown) =>
  error instanceof type && error.detail.key === key;

const SELF = 999;
const PROCESSES = [
  processInfo(1, "init", { ppid: 0 }),
  processInfo(100, "bash", { ppid: 1, command: 'bash -c "kiriya proc find server.js"' }),
  processInfo(200, "node", { ppid: 100, command: "node server.js --port 3000" }),
  processInfo(201, "Node.exe", { ppid: 200, command: "node worker.js" }),
  processInfo(SELF, "node", { ppid: 100, command: "node kiriya proc find node" }),
];
const table = (): FakeProcessTable => new FakeProcessTable(PROCESSES, { selfPid: SELF, protectedPids: [1, 100, SELF] });
const pids = (processes: ReadonlyArray<{ readonly pid: number }>): number[] => processes.map((entry) => entry.pid);

test("proc list filters by name in any case, sorts by name then id, and details only on request", async () => {
  const processes = table();
  const list = new ListProcesses(processes);
  const nodes = expectDone(await list.execute(listSpec.input.parse(raw([], { name: "NODE" })), commandContext("/")));
  assert.deepEqual(pids(nodes.data.processes), [200, SELF, 201]);
  await list.execute(listSpec.input.parse(raw([], { full: true })), commandContext("/"));
  assert.deepEqual(processes.listed, [false, true]);
  const none = expectDone(await list.execute(listSpec.input.parse(raw([], { name: "python" })), commandContext("/")));
  assert.deepEqual(
    none.failures.map((failure) => failure.key),
    ["proc.list.none"],
  );
});

test("proc find matches names and command lines, but not kiriya or the text its launcher echoes", async () => {
  const find = new FindProcesses(table());
  const byCommand = expectDone(await find.execute(findSpec.input.parse(raw(["SERVER.JS"])), commandContext("/")));
  assert.deepEqual(pids(byCommand.data.processes), [200]);
  const byName = expectDone(await find.execute(findSpec.input.parse(raw(["node"])), commandContext("/")));
  assert.deepEqual(pids(byName.data.processes), [200, 201]);
  // The shell that started kiriya still turns up by its own name.
  const launcher = expectDone(await find.execute(findSpec.input.parse(raw(["bash"])), commandContext("/")));
  assert.deepEqual(pids(launcher.data.processes), [100]);
  const none = expectDone(await find.execute(findSpec.input.parse(raw(["python"])), commandContext("/")));
  assert.deepEqual(
    none.failures.map((failure) => failure.key),
    ["proc.find.none"],
  );
  assert.throws(() => findSpec.input.parse(raw(["  "])), UsageError);
});

test("proc kill by name ends every match, with or without .exe, except protected processes", async () => {
  const processes = table();
  const kill = new EndProcesses(processes);
  await assert.rejects(
    kill.execute(killSpec.input.parse(raw(["node"], { confirm: "nodes" })), commandContext("/")),
    failsWith(RefusedError, "core.confirm.mismatch"),
  );
  assert.deepEqual(processes.ended, []);

  const result = expectDone(
    await kill.execute(killSpec.input.parse(raw(["node"], { confirm: "node" })), commandContext("/")),
  );
  assert.deepEqual(processes.ended, [{ pids: [200, 201], force: false }]);
  assert.deepEqual(
    result.warnings.map((warning) => warning.key),
    ["proc.kill.skipped"],
  );
  assert.deepEqual(result.data.processes, [
    { pid: 200, name: "node", outcome: "ended" },
    { pid: 201, name: "Node.exe", outcome: "ended" },
  ]);
});

test("proc kill refuses protected ids and names, and reports what it cannot find", async () => {
  const kill = new EndProcesses(table());
  const cases: ReadonlyArray<readonly [string, new (...args: never[]) => KiriyaError, string]> = [
    [String(SELF), RefusedError, "proc.kill.protected"],
    ["init", RefusedError, "proc.kill.only-protected"],
    ["12345", NotFoundError, "proc.kill.no-pid"],
    ["python", NotFoundError, "proc.kill.no-name"],
  ];
  for (const [target, type, key] of cases) {
    await assert.rejects(
      kill.execute(killSpec.input.parse(raw([target], { confirm: target })), commandContext("/")),
      failsWith(type, key),
    );
  }
});

test("the process tree puts children under parents, one process's tree alone, and survives loops", async () => {
  const rows = (entries: ReturnType<typeof processTree>): Array<readonly [number, number]> =>
    entries.map((row) => [row.pid, row.depth]);
  const looped = [...PROCESSES, processInfo(500, "a", { ppid: 501 }), processInfo(501, "b", { ppid: 500 })];
  assert.deepEqual(rows(processTree(looped, null)), [
    [1, 0],
    [100, 1],
    [200, 2],
    [201, 3],
    [SELF, 2],
    [500, 0],
    [501, 1],
  ]);
  assert.deepEqual(rows(processTree(PROCESSES, 100)), [
    [100, 0],
    [200, 1],
    [201, 2],
    [SELF, 1],
  ]);

  const tree = new ShowTree(table());
  const shown = expectDone(await tree.execute(treeSpec.input.parse(raw(["200"])), commandContext("/")));
  assert.deepEqual(pids(shown.data.rows), [200, 201]);
  await assert.rejects(
    tree.execute(treeSpec.input.parse(raw(["4242"])), commandContext("/")),
    failsWith(NotFoundError, "proc.tree.no-pid"),
  );
  assert.throws(() => treeSpec.input.parse(raw(["node"])), UsageError);
});

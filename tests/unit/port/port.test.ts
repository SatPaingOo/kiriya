import assert from "node:assert/strict";
import { test } from "node:test";
import { KiriyaError, NotFoundError, RefusedError, UsageError } from "../../../src/core/domain/errors.js";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import type { Listener } from "../../../src/core/domain/ports/port-table.js";
import { EndPortOwners, killSpec } from "../../../src/modules/port/application/end-port-owners.use-case.js";
import { FindFreePort, freeSpec } from "../../../src/modules/port/application/find-free-port.use-case.js";
import { FindListeners, whoSpec } from "../../../src/modules/port/application/find-listeners.use-case.js";
import { commandContext, expectDone, FakePortTable, FakeProcessTable, processInfo } from "../../support/fakes.js";

const raw = (positionals: readonly string[], options: RawInput["options"] = {}): RawInput => ({ positionals, options });
const failsWith = (type: new (...args: never[]) => KiriyaError, key: string) => (error: unknown) =>
  error instanceof type && error.detail.key === key;

const node = processInfo(4100, "node");
const postgres = processInfo(4200, "postgres");
const LISTENERS: readonly Listener[] = [
  { address: "::", port: 3000, pid: 4100 },
  { address: "0.0.0.0", port: 3000, pid: 4100 },
  { address: "127.0.0.1", port: 5432, pid: 4200 },
  { address: "0.0.0.0", port: 8080, pid: null },
];

test("port who names each listener's owner, on one port or on all", async () => {
  const processes = new FakeProcessTable([node, postgres]);
  const who = new FindListeners(new FakePortTable(LISTENERS), processes);

  const one = expectDone(await who.execute(whoSpec.input.parse(raw(["3000"])), commandContext("/")));
  assert.deepEqual(one.data.listeners, [
    { address: "0.0.0.0", port: 3000, pid: 4100, name: "node" },
    { address: "::", port: 3000, pid: 4100, name: "node" },
  ]);
  const all = expectDone(await who.execute(whoSpec.input.parse(raw([])), commandContext("/")));
  assert.deepEqual(
    all.data.listeners.map((listener) => [listener.port, listener.name]),
    [
      [3000, "node"],
      [3000, "node"],
      [5432, "postgres"],
      [8080, null],
    ],
  );
  const none = expectDone(await who.execute(whoSpec.input.parse(raw(["9999"])), commandContext("/")));
  assert.deepEqual(none.data.listeners, []);
  // Names are looked up only when there is an owner to name.
  assert.deepEqual(processes.listed, [false, false]);
  assert.throws(() => whoSpec.input.parse(raw(["70000"])), UsageError);
});

test("port kill ends the owners once the port is typed, and refuses what it must not end", async () => {
  const processes = new FakeProcessTable([node, postgres], { protectedPids: [4200] });
  const kill = new EndPortOwners(new FakePortTable(LISTENERS), processes);
  const input = (port: string, options: RawInput["options"]) => killSpec.input.parse(raw([port], options));

  await assert.rejects(
    kill.execute(input("3000", { confirm: "3001" }), commandContext("/")),
    failsWith(RefusedError, "core.confirm.mismatch"),
  );
  assert.deepEqual(processes.ended, []);

  const result = expectDone(await kill.execute(input("3000", { confirm: "3000", force: true }), commandContext("/")));
  assert.deepEqual(processes.ended, [{ pids: [4100], force: true }]);
  assert.deepEqual(result.data.processes, [{ pid: 4100, name: "node", outcome: "ended" }]);

  const refusals: ReadonlyArray<readonly [string, new (...args: never[]) => KiriyaError, string]> = [
    ["5432", RefusedError, "port.kill.protected"],
    ["8080", RefusedError, "port.kill.hidden"],
    ["9999", NotFoundError, "port.kill.nothing"],
  ];
  for (const [port, type, key] of refusals) {
    await assert.rejects(kill.execute(input(port, { confirm: port }), commandContext("/")), failsWith(type, key));
  }
  assert.equal(processes.ended.length, 1);
});

test("a process that outlives the request to exit is a failure that suggests --force", async () => {
  const processes = new FakeProcessTable([node], { outcome: "still-running" });
  const kill = new EndPortOwners(new FakePortTable(LISTENERS), processes);
  const result = expectDone(
    await kill.execute(killSpec.input.parse(raw(["3000"], { confirm: "3000" })), commandContext("/")),
  );
  assert.deepEqual(result.failures, [
    { key: "core.end.still-running", params: { name: "node", pid: 4100, code: "still-running" } },
  ]);
});

test("port free skips ports that something listens on or that cannot be opened", async () => {
  const table = new FakePortTable([{ address: "::", port: 3000, pid: 1 }], new Set([3001]));
  const free = new FindFreePort(table);
  const first = expectDone(await free.execute(freeSpec.input.parse(raw([])), commandContext("/")));
  assert.equal(first.data.port, 3002);
  assert.deepEqual(table.tried, [3001, 3002]);
  const later = expectDone(await free.execute(freeSpec.input.parse(raw([], { from: "40000" })), commandContext("/")));
  assert.equal(later.data.port, 40_000);
  assert.throws(() => freeSpec.input.parse(raw([], { from: "0" })), UsageError);
});

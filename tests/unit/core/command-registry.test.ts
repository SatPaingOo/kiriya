import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { done, type Command } from "../../../src/core/domain/command.js";
import type { CorePorts, KiriyaModule } from "../../../src/core/domain/module.js";

const ports = {} as CorePorts;

function command(id: `${string}.${string}`): Command<undefined, undefined> {
  return {
    spec: {
      id,
      summary: "files.list.summary",
      input: { positionals: [], options: {}, parse: () => undefined },
      examples: [],
      safety: "read",
      idempotent: true,
      usesNetwork: false,
      runsUserCommands: false,
    },
    execute: () => Promise.resolve(done(undefined)),
  };
}

function moduleWith(id: string, commandIds: ReadonlyArray<`${string}.${string}`>): KiriyaModule {
  return {
    id,
    summary: "files.summary",
    register(registrar) {
      for (const commandId of commandIds) registrar.add(command(commandId), () => []);
    },
  };
}

test("commands are found by module and verb, modules listed in code-point order", () => {
  const registry = new CommandRegistry();
  registry.register(moduleWith("zip", ["zip.pack"]), ports);
  registry.register(moduleWith("files", ["files.list", "files.find"]), ports);
  assert.deepEqual(
    registry.list().map((module) => module.id),
    ["files", "zip"],
  );
  assert.equal(registry.module("files")?.commands.get("find")?.command.spec.id, "files.find");
  assert.equal(registry.module("nope"), undefined);
});

test("a command outside its module, a duplicate verb or a duplicate module is a programming error", () => {
  assert.throws(() => new CommandRegistry().register(moduleWith("files", ["git.status"]), ports), /does not belong/);
  assert.throws(
    () => new CommandRegistry().register(moduleWith("files", ["files.list", "files.list"]), ports),
    /twice/,
  );
  const registry = new CommandRegistry();
  registry.register(moduleWith("files", []), ports);
  assert.throws(() => registry.register(moduleWith("files", []), ports), /twice/);
});

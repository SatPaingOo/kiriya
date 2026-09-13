import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { done, type Command } from "../../../src/core/domain/command.js";
import type { CorePorts, KiriyaModule } from "../../../src/core/domain/module.js";

const ports = {} as CorePorts;

function command(id: string): Command<undefined, undefined> {
  return {
    spec: {
      id,
      summary: "doctor.summary",
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

function moduleWith(id: string, commandIds: readonly string[]): KiriyaModule {
  return {
    id,
    summary: "doctor.summary",
    register(registrar) {
      for (const commandId of commandIds) registrar.add(command(commandId), () => []);
    },
  };
}

test("a command whose id is the module's own is the module's single command, under an empty verb", () => {
  const registry = new CommandRegistry();
  registry.register(moduleWith("doctor", ["doctor"]), ports);
  assert.deepEqual([...(registry.module("doctor")?.commands.keys() ?? [])], [""]);
});

test("ids with an empty or nested verb do not belong to the module, and nothing of it registers", () => {
  for (const bad of ["doctor.", "doctor.a.b", "doctorx"]) {
    const registry = new CommandRegistry();
    assert.throws(() => registry.register(moduleWith("doctor", ["doctor.ok", bad]), ports), /does not belong/);
    assert.equal(registry.module("doctor"), undefined);
  }
});

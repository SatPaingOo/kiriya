import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_MODULES } from "../../../src/config/modules.js";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { KiriyaError } from "../../../src/core/domain/errors.js";
import type { InputSchema, OptionSpec, RawInput } from "../../../src/core/domain/input-schema.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import { optionLabel } from "../../../src/core/presentation/cli/help.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { inputSchemaOf } from "../../../src/core/presentation/mcp/tool-definitions.js";
import { en } from "../../../src/i18n/locales/en.js";

const translator = new Translator(en);
const ports = {} as CorePorts;

function everyCommand(): { id: string; input: InputSchema<unknown> }[] {
  const registry = new CommandRegistry();
  for (const module of BUILT_IN_MODULES) registry.register(module, ports);
  const all: { id: string; input: InputSchema<unknown> }[] = [];
  for (const module of registry.list()) {
    for (const entry of module.commands.values()) {
      all.push({ id: entry.command.spec.id, input: entry.command.spec.input });
    }
  }
  return all;
}

/** Enough positionals to get past "missing argument" and reach the option being tested. */
function rawWith(input: InputSchema<unknown>, option: string, value: string): RawInput {
  return { positionals: input.positionals.map(() => "x"), options: { [option]: value } };
}

const optionsOf = (input: InputSchema<unknown>): [string, OptionSpec][] => Object.entries(input.options);

test("an option whose value is checked against a list declares that list", () => {
  const undeclared: string[] = [];
  for (const { id, input } of everyCommand()) {
    for (const [name, spec] of optionsOf(input)) {
      if (spec.type !== "string" || spec.multiple === true || spec.choices !== undefined) continue;
      // A value nothing would accept: if parse rejects it as "not one of", the option has a list.
      let rejectedAsChoice = false;
      try {
        input.parse(rawWith(input, name, "zzz-not-a-valid-choice-zzz"));
      } catch (error) {
        rejectedAsChoice = error instanceof KiriyaError && error.detail.key === "core.usage.not-a-choice";
      }
      if (rejectedAsChoice) undeclared.push(`${id} --${name}`);
    }
  }
  assert.deepEqual(
    undeclared,
    [],
    `these options check a list of values but never declare it, so MCP cannot offer it as an enum: ${undeclared.join(", ")}`,
  );
});

test("a declared list reaches the MCP schema as an enum, and help as the value name", () => {
  let checked = 0;
  for (const { id, input } of everyCommand()) {
    const schema = inputSchemaOf(id, input, translator, { sensitive: true, changes: false }) as {
      properties: Record<string, { enum?: readonly string[] } | undefined>;
    };
    for (const [name, spec] of optionsOf(input)) {
      if (spec.choices === undefined) continue;
      checked++;
      const short = spec.short === undefined ? "" : `-${spec.short}, `;
      assert.equal(optionLabel(name, spec), `${short}--${name} <${spec.choices.join("|")}>`, `${id} --${name} in help`);
      const property = schema.properties[name];
      if (property === undefined) continue; // Not offered over MCP; other tests cover which are.
      assert.deepEqual(property.enum, [...spec.choices], `${id} --${name} in the MCP schema`);
    }
  }
  assert.ok(checked >= 10, `expected the built-in commands to declare several lists, saw ${checked}`);
});

test("an option that names a value but takes anything keeps a plain value name", () => {
  // `docker logs --tail <n|all>` takes a number or the word all, so it is not a list of values.
  const logs = everyCommand().find(({ id }) => id === "docker.logs");
  assert.ok(logs);
  const tail = logs.input.options["tail"];
  assert.ok(tail);
  assert.equal(tail.choices, undefined);
  assert.equal(optionLabel("tail", tail), "--tail <n|all>");
});

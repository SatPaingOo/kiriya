import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_MODULES } from "../../../src/config/modules.js";
import { OUTPUT_SHAPES } from "../../../src/config/output-shapes.js";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import type { OutputShapes, Shape } from "../../../src/core/domain/output-shape.js";
import { dataSchema } from "../../../src/core/presentation/mcp/output-schema.js";
import { outputSchemaOf } from "../../../src/core/presentation/mcp/tool-definitions.js";

const catalog = (records: Record<string, Shape>): OutputShapes => ({ records, commands: {} });
const empty = catalog({});

test("a scalar becomes its type, and a nullable one becomes either that or null", () => {
  assert.deepEqual(dataSchema(empty, { kind: "string" }), { type: "string" });
  assert.deepEqual(dataSchema(empty, { kind: "number", nullable: true }), { type: ["number", "null"] });
  assert.deepEqual(dataSchema(empty, { kind: "boolean" }), { type: "boolean" });
  // Nothing is claimed about an unknown, which an empty schema says exactly.
  assert.deepEqual(dataSchema(empty, { kind: "unknown" }), {});
  assert.deepEqual(dataSchema(empty, { kind: "string", description: "What it is" }), {
    type: "string",
    description: "What it is",
  });
});

test("a choice lists its values, and a nullable choice lists null among them", () => {
  assert.deepEqual(dataSchema(empty, { kind: "choice", of: ["a", "b"] }), {
    type: "string",
    enum: ["a", "b"],
  });
  assert.deepEqual(dataSchema(empty, { kind: "choice", of: ["a"], nullable: true }), {
    type: ["string", "null"],
    enum: ["a", null],
  });
});

test("a record names every field it always has, and leaves an optional one out of required", () => {
  const shape: Shape = {
    kind: "record",
    fields: {
      always: { kind: "string" },
      maybeNull: { kind: "number", nullable: true },
      maybeAbsent: { kind: "string", optional: true },
    },
  };
  assert.deepEqual(dataSchema(empty, shape), {
    type: "object",
    properties: {
      always: { type: "string" },
      maybeNull: { type: ["number", "null"] },
      maybeAbsent: { type: "string" },
    },
    // nullable says a field may be null, not that it may be missing, so it stays required.
    required: ["always", "maybeNull"],
    additionalProperties: false,
  });
});

test("a ref is written out in place, under the name it came from", () => {
  const shapes = catalog({ "port.OwnedListener": { kind: "record", fields: { pid: { kind: "number" } } } });
  const schema = dataSchema(shapes, {
    kind: "list",
    of: { kind: "ref", named: "port.OwnedListener" },
  });
  assert.deepEqual(schema, {
    type: "array",
    items: {
      type: "object",
      properties: { pid: { type: "number" } },
      required: ["pid"],
      additionalProperties: false,
      title: "port.OwnedListener",
    },
  });
});

/** A client should not have to resolve anything, so a type that contains itself has to stop somewhere. */
test("a type that contains itself stops as a plain object rather than expanding forever", () => {
  const shapes = catalog({
    "core.Message": {
      kind: "record",
      fields: { key: { kind: "string" }, inner: { kind: "ref", named: "core.Message" } },
    },
  });
  const schema = dataSchema(shapes, { kind: "ref", named: "core.Message" }) as {
    properties: { inner: unknown };
  };
  assert.deepEqual(schema.properties.inner, { type: "object", title: "core.Message" });
});

test("a ref the catalog does not hold is an object, not a crash", () => {
  assert.deepEqual(dataSchema(empty, { kind: "ref", named: "nothing.Here" }), {
    type: "object",
    title: "nothing.Here",
  });
});

test("every registered command has a shape, and every ref in it resolves", () => {
  const registry = new CommandRegistry();
  for (const module of BUILT_IN_MODULES) registry.register(module, {} as CorePorts);
  const ids = registry.list().flatMap((module) => [...module.commands.values()].map((e) => e.command.spec.id));

  const missing = ids.filter((id) => OUTPUT_SHAPES.commands[id] === undefined);
  assert.deepEqual(missing, [], "run npm run shapes");
  const extra = Object.keys(OUTPUT_SHAPES.commands).filter((id) => !ids.includes(id));
  assert.deepEqual(extra, [], "shapes for commands that are not registered");

  const dangling: string[] = [];
  const walk = (shape: Shape): void => {
    if (shape.kind === "ref" && OUTPUT_SHAPES.records[shape.named] === undefined) dangling.push(shape.named);
    else if (shape.kind === "list") walk(shape.of);
    else if (shape.kind === "record") Object.values(shape.fields).forEach(walk);
  };
  for (const shape of Object.values(OUTPUT_SHAPES.commands)) walk(shape);
  for (const shape of Object.values(OUTPUT_SHAPES.records)) walk(shape);
  assert.deepEqual([...new Set(dangling)], []);
});

test("a tool declares the shape of its own data, and an unknown command claims nothing", () => {
  const who = outputSchemaOf("port.who") as { properties: { data: { title?: string; properties?: object } } };
  assert.equal(who.properties.data.title, "port.WhoOutput");
  assert.ok(who.properties.data.properties, "the data of port.who is described");

  // A plugin's command has no shape here, and must not be given one by accident.
  const plugin = outputSchemaOf("someplugin.whatever") as { properties: { data: object } };
  assert.deepEqual(plugin.properties.data, {});
});

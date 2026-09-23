import type { CommandSpec } from "../../domain/command.js";
import { UsageError } from "../../domain/errors.js";
import type { InputSchema, OptionSpec, RawInput } from "../../domain/input-schema.js";
import { message } from "../../domain/message.js";
import type { Translator } from "../i18n/translator.js";
import { isObject, type JsonObject } from "./protocol.js";

export type ToolAnnotations = {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
};

export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
  readonly outputSchema: JsonObject;
  readonly annotations: ToolAnnotations;
};

const MESSAGES = { type: "array", items: { type: "object" } };

/** The JSON document `--json` prints, for a result and for an error alike, plus what the server adds. */
export const OUTPUT_SCHEMA: JsonObject = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    command: { type: "string" },
    kind: { type: "string", enum: ["done", "preview"] },
    applyFlag: { type: "string" },
    data: {},
    warnings: MESSAGES,
    failures: MESSAGES,
    error: { type: "object" },
    output: { type: "string", description: "What a program the command ran printed" },
    truncated: {
      type: "array",
      items: { type: "object" },
      description: "Where the result was cut to fit, and how much",
    },
  },
  required: ["ok"],
};

/** What decides which options a tool offers besides the ordinary ones. */
export type ToolAccess = {
  /** The user's `mcp.allowWrite` setting, which lets sensitive options in. */
  readonly sensitive: boolean;
  /** The tool changes something, so options that reach hidden folders stay out. */
  readonly changes: boolean;
};

const READING: ToolAccess = { sensitive: false, changes: false };

export function toolAccess(spec: CommandSpec<unknown>, allowWrite: boolean): ToolAccess {
  return { sensitive: allowWrite, changes: spec.safety !== "read" };
}

/** The options a tool takes: never those only for a terminal, and the others as access allows. */
function toolOptions(input: InputSchema<unknown>, access: ToolAccess): Array<[string, OptionSpec]> {
  return Object.entries(input.options).filter(
    ([, option]) =>
      option.terminalOnly !== true &&
      (option.sensitive !== true || access.sensitive) &&
      (option.reachesHidden !== true || !access.changes),
  );
}

/** All four annotations, always, because a client assumes the worst for any left out. */
export function annotationsOf(spec: CommandSpec<unknown>): ToolAnnotations {
  return {
    readOnlyHint: spec.safety === "read",
    destructiveHint: spec.safety === "destroy",
    idempotentHint: spec.idempotent,
    openWorldHint: spec.usesNetwork,
  };
}

/** One property per argument and option, named as in help; arguments a command needs are required. */
export function inputSchemaOf(
  commandId: string,
  input: InputSchema<unknown>,
  translator: Translator,
  access: ToolAccess = READING,
): JsonObject {
  const properties: JsonObject = {};
  const required: string[] = [];
  const claim = (name: string, schema: JsonObject): void => {
    if (Object.hasOwn(properties, name)) throw new Error(`${commandId}: ${name} is both an argument and an option`);
    properties[name] = schema;
  };

  for (const positional of input.positionals) {
    const description = translator.text(message(positional.description));
    const value: JsonObject = {
      type: "string",
      ...(positional.choices === undefined ? {} : { enum: [...positional.choices] }),
    };
    claim(
      positional.name,
      positional.variadic
        ? { type: "array", items: value, ...(positional.required ? { minItems: 1 } : {}), description }
        : { ...value, description },
    );
    if (positional.required) required.push(positional.name);
  }
  for (const [name, option] of toolOptions(input, access)) {
    const text = translator.text(message(option.description));
    // Choices belong in the enum, where a client can act on them, rather than in prose it must read.
    const description = option.valueName === undefined ? text : `${text} ${option.valueName}`;
    const choices = option.choices === undefined ? {} : { enum: [...option.choices] };
    if (option.type === "boolean") claim(name, { type: "boolean", description });
    else if (option.multiple === true)
      claim(name, { type: "array", items: { type: "string", ...choices }, description });
    else claim(name, { type: "string", ...choices, description });
  }
  return { type: "object", properties, ...(required.length > 0 ? { required } : {}), additionalProperties: false };
}

export function toolDefinition(
  spec: CommandSpec<unknown>,
  translator: Translator,
  allowWrite: boolean,
): ToolDefinition {
  return {
    name: spec.id,
    description: translator.text(message(spec.summary)),
    inputSchema: inputSchemaOf(spec.id, spec.input, translator, toolAccess(spec, allowWrite)),
    outputSchema: OUTPUT_SCHEMA,
    annotations: annotationsOf(spec),
  };
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string") throw new UsageError("core.mcp.expects-text", { name });
  return value;
}

function textList(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    throw new UsageError("core.mcp.expects-list", { name });
  }
  return value;
}

/**
 * The JSON arguments of a call as the command's raw input, checked against the schema
 * the tool publishes. The command's own parse checks the values next, as it does for argv.
 */
export function rawInputOf(input: InputSchema<unknown>, args: unknown, access: ToolAccess = READING): RawInput {
  const given = args ?? {};
  if (!isObject(given)) throw new UsageError("core.mcp.arguments-not-object");
  const options = new Map(toolOptions(input, access));
  for (const name of Object.keys(given)) {
    if (!options.has(name) && !input.positionals.some((positional) => positional.name === name)) {
      throw new UsageError("core.mcp.unknown-argument", { name });
    }
  }

  const positionals: string[] = [];
  let skipped: string | undefined;
  for (const positional of input.positionals) {
    const value = given[positional.name];
    const values =
      value === undefined
        ? []
        : positional.variadic
          ? textList(value, positional.name)
          : [text(value, positional.name)];
    if (values.length === 0) {
      if (positional.required) throw new UsageError("core.usage.missing-argument", { name: positional.name });
      skipped ??= positional.name;
      continue;
    }
    // Arguments are positional underneath, so a later one cannot stand in for an earlier one left out.
    if (skipped !== undefined) throw new UsageError("core.usage.missing-argument", { name: skipped });
    positionals.push(...values);
  }

  const raw: Record<string, string | boolean | readonly string[]> = {};
  for (const [name, option] of options) {
    const value = given[name];
    if (value === undefined) continue;
    if (option.type === "boolean") {
      if (typeof value !== "boolean") throw new UsageError("core.mcp.expects-boolean", { name });
      if (value) raw[name] = true;
    } else {
      raw[name] = option.multiple === true ? textList(value, name) : text(value, name);
    }
  }
  return { positionals, options: raw };
}

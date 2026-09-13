import { parseArgs, type ParseArgsConfig } from "node:util";
import { UsageError } from "../../domain/errors.js";
import type { InputSchema, RawInput } from "../../domain/input-schema.js";
import { message } from "../../domain/message.js";
import { closest } from "./suggest.js";

export interface GlobalFlags {
  readonly json: boolean;
  readonly noColor: boolean;
  readonly noInput: boolean;
  readonly debug: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

const GLOBAL_TOKENS: Readonly<Record<string, keyof GlobalFlags>> = {
  "--json": "json",
  "--no-color": "noColor",
  "--no-input": "noInput",
  "--debug": "debug",
  "--help": "help",
  "-h": "help",
  "--version": "version",
  "-V": "version",
};

/** Global flags may appear anywhere before `--`; they are taken out before the command parses the rest. */
export function splitGlobalFlags(argv: readonly string[]): { flags: GlobalFlags; rest: string[] } {
  const flags: Record<keyof GlobalFlags, boolean> = {
    json: false,
    noColor: false,
    noInput: false,
    debug: false,
    help: false,
    version: false,
  };
  const rest: string[] = [];
  let passthrough = false;
  for (const token of argv) {
    const flag = passthrough ? undefined : GLOBAL_TOKENS[token];
    if (token === "--") passthrough = true;
    if (flag === undefined) rest.push(token);
    else flags[flag] = true;
  }
  return { flags, rest };
}

/** Node's parseArgs errors carry English text; turn the common ones into message keys. */
function usageError(error: unknown, schema: InputSchema<unknown>): UsageError {
  const code = (error as { code?: unknown }).code;
  const text = error instanceof Error ? error.message : String(error);
  const option = /'(?:-\w, )?(-{1,2}[^'\s=,]+)/.exec(text)?.[1];
  if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" && option !== undefined) {
    const known = [...Object.keys(schema.options), ...Object.keys(GLOBAL_TOKENS).map((token) => token.slice(2))].map(
      (name) => `--${name}`,
    );
    const suggestion = option.startsWith("--") ? closest(option, known) : undefined;
    return new UsageError(
      "core.usage.unknown-option",
      suggestion === undefined ? { option } : { option, hint: message("core.usage.did-you-mean", { suggestion }) },
    );
  }
  if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE" && option !== undefined) {
    const name = option.replace(/^-+/, "");
    const key = text.includes("does not take an argument") ? "core.usage.takes-no-value" : "core.usage.expects-value";
    return new UsageError(key, { option: name });
  }
  return new UsageError("core.usage.bad-arguments", { detail: text });
}

/** argv for one command, checked against its schema: unknown flags and argument counts are usage errors. */
export function parseCommandArguments(schema: InputSchema<unknown>, args: readonly string[]): RawInput {
  const options: NonNullable<ParseArgsConfig["options"]> = {};
  for (const [name, spec] of Object.entries(schema.options)) {
    options[name] = {
      type: spec.type,
      ...(spec.short === undefined ? {} : { short: spec.short }),
      ...(spec.multiple === true ? { multiple: true } : {}),
    };
  }

  let parsed: { values: Record<string, unknown>; positionals: string[] };
  try {
    parsed = parseArgs({ args: [...args], options, allowPositionals: true, strict: true });
  } catch (error) {
    throw usageError(error, schema);
  }

  const variadic = schema.positionals.some((positional) => positional.variadic);
  if (!variadic && parsed.positionals.length > schema.positionals.length) {
    throw new UsageError("core.usage.too-many-arguments", {
      extra: parsed.positionals.slice(schema.positionals.length).join(" "),
    });
  }
  const missing = schema.positionals.find(
    (positional, index) => positional.required && parsed.positionals[index] === undefined,
  );
  if (missing !== undefined) throw new UsageError("core.usage.missing-argument", { name: missing.name });

  return { positionals: parsed.positionals, options: parsed.values as RawInput["options"] };
}

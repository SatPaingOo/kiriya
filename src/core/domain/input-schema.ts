import type { MessageKey } from "../../i18n/locales/en.js";
import { UsageError } from "./errors.js";

export interface OptionSpec {
  readonly type: "string" | "boolean";
  readonly description: MessageKey;
  /** One letter, only for very common options. */
  readonly short?: string;
  readonly multiple?: boolean;
  /** Shown in help after the flag, such as `<size>`. */
  readonly valueName?: string;
}

export interface PositionalSpec {
  readonly name: string;
  readonly description: MessageKey;
  readonly required: boolean;
  readonly variadic: boolean;
  /** The only values it takes, which completion offers. */
  readonly choices?: readonly string[];
}

/** Values as they arrive from argv or, later, an MCP call, before validation. */
export interface RawInput {
  readonly positionals: readonly string[];
  readonly options: Readonly<Record<string, string | boolean | readonly string[] | undefined>>;
}

/** What a command accepts, and how raw values become its typed input. */
export interface InputSchema<Input> {
  readonly positionals: readonly PositionalSpec[];
  readonly options: Readonly<Record<string, OptionSpec>>;
  /** Throws UsageError for a value the command cannot use. */
  parse(raw: RawInput): Input;
}

/** Typed access to raw values, with usage errors that name the option. */
export class RawReader {
  constructor(private readonly raw: RawInput) {}

  positional(index: number): string | undefined {
    return this.raw.positionals[index];
  }

  positionalsFrom(index: number): readonly string[] {
    return this.raw.positionals.slice(index);
  }

  flag(name: string): boolean {
    return this.raw.options[name] === true;
  }

  string(name: string): string | undefined {
    const value = this.raw.options[name];
    if (value === undefined || value === false) return undefined;
    if (typeof value !== "string") throw new UsageError("core.usage.expects-value", { option: name });
    return value;
  }

  strings(name: string): readonly string[] {
    const value = this.raw.options[name];
    if (value === undefined || value === false) return [];
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value as readonly string[];
    throw new UsageError("core.usage.expects-value", { option: name });
  }

  choice<T extends string>(name: string, choices: readonly T[], fallback: T): T {
    const value = this.string(name);
    if (value === undefined) return fallback;
    const match = choices.find((choice) => choice === value);
    if (match === undefined)
      throw new UsageError("core.usage.not-a-choice", { option: name, choices: choices.join(", ") });
    return match;
  }

  positiveInteger(name: string, fallback: number): number {
    const value = this.string(name);
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1)
      throw new UsageError("core.usage.not-a-positive-integer", { option: name });
    return number;
  }
}

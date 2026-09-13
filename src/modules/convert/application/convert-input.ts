import path from "node:path";
import { utf8Bytes, utf8Text } from "../../../core/domain/encodings.js";
import { NotFoundError, OperationFailedError, UsageError } from "../../../core/domain/errors.js";
import type { OptionSpec, PositionalSpec } from "../../../core/domain/input-schema.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { StandardInput } from "../../../core/domain/ports/standard-input.js";
import { formatBytes } from "../../../core/domain/values/bytes.js";

/** Every conversion runs on this machine, changes nothing, and gives the same result for the same input. */
export const CONVERTER = { safety: "read", idempotent: true, usesNetwork: false, runsUserCommands: false } as const;

/** Conversions work in memory, so input stops here. */
export const INPUT_LIMIT_BYTES = 16 * 1024 * 1024;

export const valuePositional: PositionalSpec = {
  name: "value",
  description: "convert.arg.value",
  required: false,
  variadic: false,
};

export const fileOption: OptionSpec = { type: "string", description: "convert.option.file", valueName: "<path>" };

export interface InputSources {
  readonly stdin: StandardInput;
  readonly fileSystem: FileSystem;
  readonly content: FileContent;
}

export interface ConvertInput {
  readonly bytes: Uint8Array;
  readonly from: "argument" | "stdin" | "file";
}

/** The value argument; everything piped in when it is `-` or missing; or a file's exact bytes with --file. */
export async function readInput(
  sources: InputSources,
  cwd: string,
  value: string | undefined,
  file: string | undefined,
): Promise<ConvertInput> {
  if (file !== undefined) {
    if (value !== undefined) throw new UsageError("convert.input-twice");
    const target = path.resolve(cwd, file);
    const stat = await sources.fileSystem.stat(target);
    if (stat?.kind !== "file") throw new NotFoundError("core.fs.not-found", { path: target });
    if (stat.size > INPUT_LIMIT_BYTES) {
      throw new OperationFailedError("convert.input-too-large", { limit: formatBytes(INPUT_LIMIT_BYTES) });
    }
    return { bytes: await sources.content.read(target), from: "file" };
  }
  if (value !== undefined && value !== "-") return { bytes: utf8Bytes(value), from: "argument" };
  if (value === undefined && sources.stdin.isTerminal) throw new UsageError("convert.input-missing");
  return { bytes: await sources.stdin.read(INPUT_LIMIT_BYTES), from: "stdin" };
}

/**
 * The input as text, without a byte order mark. Text piped in also loses one final
 * line ending, so `echo` in bash and in PowerShell, which end lines differently,
 * give the same result.
 */
export function inputText(input: ConvertInput): string {
  const decoded = utf8Text(input.bytes);
  if (decoded === null) throw new UsageError("convert.input-not-text");
  const text = decoded.replace(/^\uFEFF/, "");
  return input.from === "stdin" ? text.replace(/\r?\n$/, "") : text;
}

/** The bytes to encode: a file or an argument exactly, piped text as inputText gives it. */
export function inputBytes(input: ConvertInput): Uint8Array {
  return input.from === "stdin" ? utf8Bytes(inputText(input)) : input.bytes;
}

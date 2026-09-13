import path from "node:path";
import { utf8Bytes, utf8Text } from "../domain/encodings.js";
import { NotFoundError, OperationFailedError, UsageError } from "../domain/errors.js";
import type { FileContent } from "../domain/ports/file-content.js";
import type { FileSystem } from "../domain/ports/file-system.js";
import type { StandardInput } from "../domain/ports/standard-input.js";
import { formatBytes } from "../domain/values/bytes.js";

/** Commands that take text work in memory, so input stops here. */
export const INPUT_LIMIT_BYTES = 16 * 1024 * 1024;

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

export interface InputSources {
  readonly stdin: StandardInput;
  readonly fileSystem: FileSystem;
  readonly content: FileContent;
}

export interface InputRead {
  readonly bytes: Uint8Array;
  readonly from: "argument" | "stdin" | "file";
}

/** The value argument; everything piped in when it is `-` or missing; or a file's exact bytes with --file. */
export async function readInput(
  sources: InputSources,
  cwd: string,
  value: string | undefined,
  file: string | undefined,
): Promise<InputRead> {
  if (file !== undefined) {
    if (value !== undefined) throw new UsageError("core.input.twice");
    const target = path.resolve(cwd, file);
    const stat = await sources.fileSystem.stat(target);
    if (stat?.kind !== "file") throw new NotFoundError("core.fs.not-found", { path: target });
    if (stat.size > INPUT_LIMIT_BYTES) {
      throw new OperationFailedError("core.input.too-large", { limit: formatBytes(INPUT_LIMIT_BYTES) });
    }
    return { bytes: await sources.content.read(target), from: "file" };
  }
  if (value !== undefined && value !== "-") return { bytes: utf8Bytes(value), from: "argument" };
  if (value === undefined && sources.stdin.isTerminal) throw new UsageError("core.input.missing");
  return { bytes: await sources.stdin.read(INPUT_LIMIT_BYTES), from: "stdin" };
}

/**
 * The input as text, without a byte order mark. Text piped in also loses one final
 * line ending, so `echo` in bash and in PowerShell, which end lines differently,
 * give the same result.
 */
export function inputText(input: InputRead): string {
  const decoded = utf8Text(input.bytes);
  if (decoded === null) throw new UsageError("core.input.not-text");
  const text = decoded.startsWith(BYTE_ORDER_MARK) ? decoded.slice(1) : decoded;
  return input.from === "stdin" ? text.replace(/\r?\n$/, "") : text;
}

/** The bytes as given: a file or an argument exactly, piped text as inputText gives it. */
export function inputBytes(input: InputRead): Uint8Array {
  return input.from === "stdin" ? utf8Bytes(inputText(input)) : input.bytes;
}

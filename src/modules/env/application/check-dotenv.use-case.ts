import path from "node:path";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { utf8Text } from "../../../core/domain/encodings.js";
import { NotFoundError, OperationFailedError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { formatBytes } from "../../../core/domain/values/bytes.js";
import { parseDotenv } from "../domain/dotenv.js";

const LIMIT_BYTES = 1024 * 1024;

export interface CheckInput {
  readonly file: string;
  readonly example: string;
}

export interface MalformedLine {
  readonly path: string;
  readonly line: number;
}

/** Names only: no value from either file is ever part of the output. */
export interface CheckOutput {
  readonly file: string;
  readonly example: string;
  readonly fileExists: boolean;
  readonly expected: number;
  readonly missing: readonly string[];
  readonly empty: readonly string[];
  readonly extra: readonly string[];
  readonly duplicates: readonly string[];
  readonly malformed: readonly MalformedLine[];
}

export const checkSpec: CommandSpec<CheckInput> = {
  id: "env.check",
  summary: "env.check.summary",
  examples: ["kiriya env check", "kiriya env check --file .env.local --example .env.example"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: {
      file: { type: "string", description: "env.check.option.file", valueName: "<path>", path: true },
      example: { type: "string", description: "env.check.option.example", valueName: "<path>", path: true },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { file: reader.string("file") ?? ".env", example: reader.string("example") ?? ".env.example" };
    },
  },
};

function names(keys: readonly string[]): string {
  return keys.join(", ");
}

export class CheckDotenv implements Command<CheckInput, CheckOutput> {
  readonly spec = checkSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
  ) {}

  async execute(input: CheckInput, context: CommandContext): Promise<CommandResult<CheckOutput>> {
    const filePath = path.resolve(context.cwd, input.file);
    const examplePath = path.resolve(context.cwd, input.example);
    const exampleText = await this.readText(examplePath);
    if (exampleText === null) throw new NotFoundError("env.check.no-example", { path: examplePath });
    const fileText = await this.readText(filePath);

    const expected = parseDotenv(exampleText);
    const actual = parseDotenv(fileText ?? "");
    const expectedKeys = new Set(expected.entries.map((entry) => entry.key));
    const actualKeys = new Set(actual.entries.map((entry) => entry.key));
    // As in dotenv, a key set twice keeps its last value.
    const lastEntries = new Map(actual.entries.map((entry) => [entry.key, entry]));
    const counts = new Map<string, number>();
    for (const entry of actual.entries) counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);

    const output: CheckOutput = {
      file: input.file,
      example: input.example,
      fileExists: fileText !== null,
      expected: expectedKeys.size,
      missing: [...expectedKeys].filter((key) => !actualKeys.has(key)),
      empty: [...lastEntries.values()]
        .filter((entry) => entry.empty && expectedKeys.has(entry.key))
        .map((entry) => entry.key),
      extra: [...actualKeys].filter((key) => !expectedKeys.has(key)),
      duplicates: [...counts].filter(([, count]) => count > 1).map(([key]) => key),
      malformed: [
        ...expected.malformed.map((line) => ({ path: input.example, line })),
        ...actual.malformed.map((line) => ({ path: input.file, line })),
      ],
    };
    return done(output, { failures: this.failures(output), warnings: this.warnings(output) });
  }

  private failures(output: CheckOutput): Message[] {
    const failures: Message[] = [];
    if (!output.fileExists) {
      failures.push(message("env.check.no-file", { path: output.file, example: output.example }));
    }
    if (output.missing.length > 0) {
      const params = { count: output.missing.length, names: names(output.missing) };
      failures.push(message("env.check.missing", { ...params, example: output.example, file: output.file }));
    }
    return failures;
  }

  private warnings(output: CheckOutput): Message[] {
    const warnings: Message[] = [];
    if (output.empty.length > 0) {
      warnings.push(message("env.check.empty", { count: output.empty.length, names: names(output.empty) }));
    }
    if (output.extra.length > 0) {
      const params = { count: output.extra.length, names: names(output.extra) };
      warnings.push(message("env.check.extra", { ...params, file: output.file, example: output.example }));
    }
    if (output.duplicates.length > 0) {
      warnings.push(message("env.check.duplicates", { file: output.file, names: names(output.duplicates) }));
    }
    for (const line of output.malformed) warnings.push(message("env.check.malformed", { ...line }));
    return warnings;
  }

  /** The file's text, or null when there is no file there. */
  private async readText(target: string): Promise<string | null> {
    const stat = await this.fileSystem.stat(target);
    if (stat?.kind !== "file") return null;
    if (stat.size > LIMIT_BYTES) {
      throw new OperationFailedError("env.check.too-large", { path: target, limit: formatBytes(LIMIT_BYTES) });
    }
    const text = utf8Text(await this.content.read(target));
    if (text === null) throw new OperationFailedError("env.check.not-text", { path: target });
    return text;
  }
}

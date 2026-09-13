import { expandPaths } from "../../../core/application/paths.js";
import { requireApproval } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import { KiriyaError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { parseExtensions } from "../domain/filters.js";
import { encodeText, escapeRegExp, type TextFile } from "../domain/text-encoding.js";
import { readTextFile, selectFiles } from "./text-files.js";

/** Changed lines shown per file. */
const SAMPLE_LINES = 3;

export interface ReplaceInput {
  readonly find: string;
  readonly replacement: string;
  readonly paths: readonly string[];
  readonly regex: boolean;
  readonly ignoreCase: boolean;
  readonly extensions: readonly string[];
  readonly name: string | undefined;
  readonly all: boolean;
  readonly apply: boolean;
  readonly yes: boolean;
}

export interface ReplaceSample {
  readonly line: number;
  readonly before: string;
  readonly after: string;
}

export interface ReplacedFile {
  readonly path: string;
  readonly count: number;
  /** When the replacement adds or removes lines, no line samples are shown. */
  readonly lineCountChanges: boolean;
  readonly samples: readonly ReplaceSample[];
}

export interface ReplaceOutput {
  readonly files: readonly ReplacedFile[];
  readonly replacements: number;
  readonly checked: number;
  /** Binary files and files over 50 MB. */
  readonly skipped: number;
  readonly written: number;
}

export const replaceSpec: CommandSpec<ReplaceInput> = {
  id: "files.replace",
  summary: "files.replace.summary",
  examples: [
    "kiriya files replace OldName NewName src --ext .cs",
    'kiriya files replace "v(\\d+)\\.0" "v$1.1" --regex --apply',
    "kiriya files replace localhost:5000 localhost:8080 --name appsettings*.json --apply --yes",
  ],
  // Files are written in place and there is no undo, but --apply and a question come first.
  safety: "write",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "find", description: "files.replace.arg.find", required: true, variadic: false },
      { name: "with", description: "files.replace.arg.with", required: true, variadic: false },
      { name: "paths", description: "files.replace.arg.paths", required: false, variadic: true, path: true },
    ],
    options: {
      regex: { type: "boolean", description: "files.replace.option.regex" },
      "ignore-case": { type: "boolean", description: "files.replace.option.ignore-case", short: "i" },
      ext: { type: "string", description: "files.option.ext", valueName: "<extensions>", multiple: true },
      name: { type: "string", description: "files.option.name", valueName: "<glob>" },
      all: { type: "boolean", description: "files.option.all" },
      apply: { type: "boolean", description: "files.replace.option.apply" },
      yes: { type: "boolean", description: "files.replace.option.yes", short: "y", terminalOnly: true },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const find = reader.positional(0) ?? "";
      if (find === "") throw new UsageError("files.replace.empty-find");
      const regex = reader.flag("regex");
      if (regex) {
        try {
          new RegExp(find, "g");
        } catch {
          throw new UsageError("files.replace.bad-pattern", { pattern: find });
        }
      }
      return {
        find,
        replacement: reader.positional(1) ?? "",
        paths: reader.positionalsFrom(2),
        regex,
        ignoreCase: reader.flag("ignore-case"),
        extensions: parseExtensions(reader.strings("ext")),
        name: reader.string("name"),
        all: reader.flag("all"),
        apply: reader.flag("apply"),
        yes: reader.flag("yes"),
      };
    },
  },
};

function samplesOf(before: string, after: string): Pick<ReplacedFile, "lineCountChanges" | "samples"> {
  const oldLines = before.split(/\r?\n/);
  const newLines = after.split(/\r?\n/);
  if (oldLines.length !== newLines.length) return { lineCountChanges: true, samples: [] };
  const samples: ReplaceSample[] = [];
  for (let index = 0; index < oldLines.length && samples.length < SAMPLE_LINES; index += 1) {
    const old = oldLines[index] ?? "";
    const next = newLines[index] ?? "";
    if (old !== next) samples.push({ line: index + 1, before: old.trim(), after: next.trim() });
  }
  return { lineCountChanges: false, samples };
}

export class ReplaceText implements Command<ReplaceInput, ReplaceOutput> {
  readonly spec = replaceSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
  ) {}

  async execute(input: ReplaceInput, context: CommandContext): Promise<CommandResult<ReplaceOutput>> {
    const pattern = new RegExp(input.regex ? input.find : escapeRegExp(input.find), input.ignoreCase ? "gi" : "g");
    // Without --regex a `$` in the replacement is text, not a group reference.
    const replaceIn = (text: string): string =>
      input.regex ? text.replace(pattern, input.replacement) : text.replace(pattern, () => input.replacement);
    const targets = input.paths.length === 0 ? ["."] : input.paths;
    const paths = await expandPaths(this.fileSystem, targets, context.cwd, input.all);
    const files = await selectFiles(this.fileSystem, paths, {
      all: input.all,
      extensions: input.extensions,
      name: input.name,
    });

    const changes: Array<{ readonly path: string; readonly file: TextFile }> = [];
    const replaced: ReplacedFile[] = [];
    let replacements = 0;
    let skipped = 0;
    for (const file of files) {
      if (context.signal.aborted) break;
      const current = await readTextFile(this.fileSystem, this.content, file);
      if (current === null) {
        skipped += 1;
        continue;
      }
      const count = current.text.match(pattern)?.length ?? 0;
      if (count === 0) continue;
      const updated = replaceIn(current.text);
      if (updated === current.text) continue;
      replacements += count;
      changes.push({ path: file, file: { text: updated, encoding: current.encoding } });
      replaced.push({ path: file, count, ...samplesOf(current.text, updated) });
    }

    const data: ReplaceOutput = { files: replaced, replacements, checked: files.length, skipped, written: 0 };
    if (changes.length === 0) return done(data);
    if (!input.apply) return preview(data, "--apply");

    await requireApproval(context, message("files.replace.ask", { count: changes.length }), input.yes);
    const failures: Message[] = [];
    let written = 0;
    for (const change of changes) {
      try {
        await this.content.write(change.path, encodeText(change.file));
        written += 1;
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        failures.push(error.detail);
      }
    }
    return done({ ...data, written }, { failures });
  }
}

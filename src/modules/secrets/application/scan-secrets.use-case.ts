import { DEPENDENCY_DIRECTORIES } from "../../../config/dependency-directories.js";
import { expandPaths } from "../../../core/application/paths.js";
import { readTextFile, selectFiles } from "../../../core/application/text-files.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { parseExtensions } from "../../../core/domain/filters.js";
import { findSecrets, redactSecret, type SecretKind } from "../../../core/domain/secrets.js";
import { splitLines } from "../../../core/domain/text-encoding.js";
import { isAllowed } from "../domain/allow-marker.js";

export interface SecretFinding {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly kind: SecretKind;
  /** Enough to tell whose secret it is, never enough to use it. */
  readonly sample: string;
}

export interface ScanInput {
  readonly paths: readonly string[];
  readonly extensions: readonly string[];
  readonly name: string | undefined;
  readonly all: boolean;
  readonly limit: number;
}

export interface ScanOutput {
  readonly findings: readonly SecretFinding[];
  readonly checked: number;
  /** Binary files and files over the text limit. */
  readonly skipped: number;
  /** Secrets a `kiriya:allow-secret` marker declared deliberate. */
  readonly allowed: number;
  /** Whether `--limit` cut the list short. */
  readonly truncated: boolean;
}

export const scanSpec: CommandSpec<ScanInput> = {
  id: "secrets.scan",
  summary: "secrets.scan.summary",
  examples: ["kiriya secrets scan", "kiriya secrets scan src --ext .ts", "kiriya secrets scan --json"],
  safety: "read",
  idempotent: true,
  // Nothing is sent anywhere, which is most of why anyone would use it.
  usesNetwork: false,
  runsUserCommands: false,
  // The findings point straight at secrets, as `proc list --full` and `clip paste` do.
  sensitive: true,
  input: {
    positionals: [
      { name: "paths", description: "secrets.scan.arg.paths", required: false, variadic: true, path: true },
    ],
    options: {
      ext: { type: "string", description: "files.option.ext", valueName: "<extensions>", multiple: true },
      name: { type: "string", description: "files.option.name", valueName: "<glob>" },
      all: { type: "boolean", description: "secrets.scan.option.all" },
      limit: { type: "string", description: "secrets.scan.option.limit", valueName: "<n>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        paths: reader.positionalsFrom(0),
        extensions: parseExtensions(reader.strings("ext")),
        name: reader.string("name"),
        all: reader.flag("all"),
        limit: reader.positiveInteger("limit", 500),
      };
    },
  },
};

export class ScanSecrets implements Command<ScanInput, ScanOutput> {
  readonly spec = scanSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
  ) {}

  async execute(input: ScanInput, context: CommandContext): Promise<CommandResult<ScanOutput>> {
    const targets = input.paths.length === 0 ? ["."] : input.paths;
    // Hidden files are where secrets live — .env, .npmrc, .git-credentials — so unlike the rest
    // of kiriya this walks them by default, and keeps dependency folders out instead. --all
    // drops that guard for someone who really does want to scan what they installed.
    const roots = await expandPaths(this.fileSystem, targets, context.cwd, true);
    const files = await selectFiles(this.fileSystem, roots, {
      all: true,
      extensions: input.extensions,
      name: input.name,
      ...(input.all ? {} : { skipDirectories: DEPENDENCY_DIRECTORIES }),
    });

    const findings: SecretFinding[] = [];
    let checked = 0;
    let skipped = 0;
    let allowed = 0;
    let truncated = false;

    for (const file of files) {
      const text = await readTextFile(this.fileSystem, this.content, file);
      if (text === null) {
        skipped += 1;
        continue;
      }
      checked += 1;
      const lines = splitLines(text.text);
      for (const [index, line] of lines.entries()) {
        for (const match of findSecrets(line)) {
          if (isAllowed(lines, index)) {
            allowed += 1;
            continue;
          }
          if (findings.length >= input.limit) {
            truncated = true;
            break;
          }
          findings.push({
            path: file,
            line: index + 1,
            column: match.start + 1,
            kind: match.kind,
            sample: redactSecret(line, match),
          });
        }
        if (truncated) break;
      }
      if (truncated) break;
    }

    const data: ScanOutput = { findings, checked, skipped, allowed, truncated };
    // Found means exit 1, so a hook or a CI step needs no output parsing, as files compare does.
    if (findings.length === 0) return done(data);
    return done(data, { failures: [message("secrets.scan.found", { count: findings.length })] });
  }
}

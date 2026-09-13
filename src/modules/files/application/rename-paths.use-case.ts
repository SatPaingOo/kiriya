import path from "node:path";
import { expandPaths } from "../../../core/application/paths.js";
import { refuseProtected, requireApproval } from "../../../core/application/safety.js";
import { walk, type WalkOptions } from "../../../core/application/walk.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import { KiriyaError, NotFoundError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import { invalidNameReason } from "../../../core/domain/names.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProtectedPaths } from "../../../core/domain/ports/protected-paths.js";
import { CASE_STYLES, renameByCase, type CaseStyle } from "../domain/case-style.js";
import { moveEntry } from "./move-entry.js";

const ONLY = ["files", "dirs"] as const;

export type RenameInput =
  | { readonly mode: "one"; readonly path: string; readonly newName: string }
  | {
      readonly mode: "many";
      readonly paths: readonly string[];
      readonly style: CaseStyle | undefined;
      readonly find: string | undefined;
      readonly replacement: string;
      readonly recursive: boolean;
      readonly only: (typeof ONLY)[number] | undefined;
      readonly apply: boolean;
      readonly yes: boolean;
    };

export interface PlannedRename {
  readonly from: string;
  readonly to: string;
}

export interface RenameOutput {
  readonly mode: "one" | "many";
  readonly renames: readonly PlannedRename[];
  /** Invalid names and clashes; any of them stops every rename. */
  readonly problems: readonly Message[];
  readonly renamed: number;
}

export const renameSpec: CommandSpec<RenameInput> = {
  id: "files.rename",
  summary: "files.rename.summary",
  examples: [
    "kiriya files rename notes.txt meeting-notes.txt",
    "kiriya files rename src/components --case kebab --recursive",
    'kiriya files rename "photos/*.JPG" --find " " --with "-" --apply',
  ],
  safety: "write",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "paths", description: "files.rename.arg.paths", required: false, variadic: true, path: true },
    ],
    options: {
      case: { type: "string", description: "files.rename.option.case", valueName: `<${CASE_STYLES.join("|")}>` },
      find: { type: "string", description: "files.rename.option.find", valueName: "<text>" },
      with: { type: "string", description: "files.rename.option.with", valueName: "<text>" },
      recursive: { type: "boolean", description: "files.rename.option.recursive" },
      only: { type: "string", description: "files.rename.option.only", valueName: "<files|dirs>" },
      apply: { type: "boolean", description: "files.rename.option.apply" },
      yes: { type: "boolean", description: "files.rename.option.yes", short: "y", terminalOnly: true },
    },
    parse(raw): RenameInput {
      const reader = new RawReader(raw);
      const positionals = reader.positionalsFrom(0);
      const find = reader.string("find");
      const replacement = reader.string("with");
      if (reader.string("case") === undefined && find === undefined) {
        if (replacement !== undefined) throw new UsageError("files.rename.find-with");
        const [from, newName, ...rest] = positionals;
        if (from === undefined || newName === undefined || rest.length > 0) throw new UsageError("files.rename.usage");
        return { mode: "one", path: from, newName };
      }
      if ((find === undefined) !== (replacement === undefined)) throw new UsageError("files.rename.find-with");
      if (find === "") throw new UsageError("files.rename.find-empty");
      return {
        mode: "many",
        paths: positionals,
        style: reader.string("case") === undefined ? undefined : reader.choice("case", CASE_STYLES, "kebab"),
        find,
        replacement: replacement ?? "",
        recursive: reader.flag("recursive"),
        only: reader.string("only") === undefined ? undefined : reader.choice("only", ONLY, "files"),
        apply: reader.flag("apply"),
        yes: reader.flag("yes"),
      };
    },
  },
};

export class RenamePaths implements Command<RenameInput, RenameOutput> {
  readonly spec = renameSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly protectedPaths: ProtectedPaths,
  ) {}

  async execute(input: RenameInput, context: CommandContext): Promise<CommandResult<RenameOutput>> {
    return input.mode === "one" ? this.renameOne(input, context) : this.renameMany(input, context);
  }

  private async renameOne(
    input: Extract<RenameInput, { mode: "one" }>,
    context: CommandContext,
  ): Promise<CommandResult<RenameOutput>> {
    const from = path.resolve(context.cwd, input.path);
    if ((await this.fileSystem.lstat(from)) === null) throw new NotFoundError("core.fs.not-found", { path: from });
    const invalid = invalidNameReason(input.newName);
    if (invalid !== null) {
      throw new UsageError("files.rename.invalid-name", { reason: message(invalid, { name: input.newName }) });
    }
    refuseProtected(this.protectedPaths, [from], context.cwd);
    const to = path.join(path.dirname(from), input.newName);
    await moveEntry(this.fileSystem, from, to);
    return done({ mode: "one", renames: [{ from, to }], problems: [], renamed: 1 });
  }

  private async renameMany(
    input: Extract<RenameInput, { mode: "many" }>,
    context: CommandContext,
  ): Promise<CommandResult<RenameOutput>> {
    const args = input.paths.length === 0 ? ["."] : input.paths;
    const folderArgs = new Set(args.map((arg) => path.resolve(context.cwd, arg)));
    const candidates: Array<{ readonly path: string; readonly isDirectory: boolean }> = [];
    for (const target of await expandPaths(this.fileSystem, args, context.cwd, false)) {
      const isDirectory = (await this.fileSystem.lstat(target))?.kind === "directory";
      // A folder named as an argument means its contents; a folder a glob matched means itself.
      if (!isDirectory || !folderArgs.has(target)) {
        candidates.push({ path: target, isDirectory });
        continue;
      }
      const options: WalkOptions = input.recursive ? { all: false } : { all: false, maxDepth: 1 };
      for await (const entry of walk(this.fileSystem, target, options)) {
        candidates.push({ path: entry.path, isDirectory: entry.kind === "directory" });
      }
    }

    const renames: PlannedRename[] = [];
    const problems: Message[] = [];
    for (const candidate of candidates) {
      if (input.only === "files" && candidate.isDirectory) continue;
      if (input.only === "dirs" && !candidate.isDirectory) continue;
      const name = path.basename(candidate.path);
      let next = input.find === undefined ? name : name.split(input.find).join(input.replacement);
      if (input.style !== undefined) next = renameByCase(next, input.style);
      if (next === name) continue;
      const invalid = invalidNameReason(next);
      if (invalid !== null) {
        problems.push(
          message("files.rename.invalid", { from: candidate.path, reason: message(invalid, { name: next }) }),
        );
        continue;
      }
      renames.push({ from: candidate.path, to: path.join(path.dirname(candidate.path), next) });
    }
    problems.push(...(await this.clashes(renames)));

    const data: RenameOutput = { mode: "many", renames, problems, renamed: 0 };
    if (problems.length > 0) {
      return done(data, { failures: problems, warnings: [message("files.rename.nothing-renamed")] });
    }
    if (renames.length === 0) return done(data);
    if (!input.apply) return preview(data, "--apply");

    refuseProtected(
      this.protectedPaths,
      renames.map((rename) => rename.from),
      context.cwd,
    );
    await requireApproval(context, message("files.rename.ask", { count: renames.length }), input.yes);
    const failures: Message[] = [];
    let renamed = 0;
    // Deepest first, so a folder is renamed only after everything inside it.
    for (const rename of [...renames].sort((a, b) => b.from.length - a.from.length)) {
      try {
        await moveEntry(this.fileSystem, rename.from, rename.to);
        renamed += 1;
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        failures.push(error.detail);
      }
    }
    return done({ ...data, renamed }, { failures });
  }

  /** Two renames landing on one name, compared without case as Windows and macOS do, or an existing entry. */
  private async clashes(renames: readonly PlannedRename[]): Promise<Message[]> {
    const problems: Message[] = [];
    const landing = new Map<string, string>();
    for (const rename of renames) {
      const key = rename.to.toLowerCase();
      const other = landing.get(key);
      if (other !== undefined) {
        problems.push(
          message("files.rename.clash", { first: other, second: rename.from, name: path.basename(rename.to) }),
        );
      }
      landing.set(key, rename.from);
      if ((await this.fileSystem.lstat(rename.to)) === null) continue;
      if (await this.fileSystem.sameEntry(rename.from, rename.to)) continue;
      let movedAway = false;
      for (const item of renames) {
        if (item !== rename && (await this.fileSystem.sameEntry(item.from, rename.to))) {
          movedAway = true;
          break;
        }
      }
      if (!movedAway) problems.push(message("core.fs.exists", { path: rename.to }));
    }
    return problems;
  }
}

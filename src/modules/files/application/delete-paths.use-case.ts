import path from "node:path";
import { refuseProtected, requireApproval, requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import { KiriyaError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { EntryKind, FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProtectedPaths } from "../../../core/domain/ports/protected-paths.js";
import type { Trash } from "../../../core/domain/ports/trash.js";
import { formatBytes } from "../../../core/domain/values/bytes.js";
import { expandPaths, measure, outermost } from "../../../core/application/paths.js";

export interface DeleteInput {
  readonly paths: readonly string[];
  readonly permanent: boolean;
  readonly dryRun: boolean;
  readonly yes: boolean;
  readonly confirm: string | undefined;
  readonly all: boolean;
}

export interface DeletionItem {
  readonly path: string;
  readonly kind: EntryKind;
  readonly bytes: number;
  readonly files: number;
  readonly isRepository: boolean;
  readonly outcome: "planned" | "trashed" | "deleted" | "failed";
  readonly reason: Message | null;
}

export interface DeleteOutput {
  readonly mode: "trash" | "permanent";
  readonly items: readonly DeletionItem[];
  readonly bytes: number;
}

export const deleteSpec: CommandSpec<DeleteInput> = {
  id: "files.delete",
  summary: "files.delete.summary",
  examples: [
    'kiriya files delete "logs/*.log"',
    "kiriya files delete build --dry-run",
    "kiriya files delete old-backups --permanent",
  ],
  safety: "destroy",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "paths", description: "files.delete.arg.paths", required: true, variadic: true, path: true }],
    options: {
      permanent: { type: "boolean", description: "files.delete.option.permanent" },
      "dry-run": { type: "boolean", description: "files.delete.option.dry-run" },
      yes: { type: "boolean", description: "files.delete.option.yes", short: "y", terminalOnly: true },
      confirm: { type: "string", description: "files.delete.option.confirm", valueName: "<count>", terminalOnly: true },
      all: { type: "boolean", description: "files.option.all" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        paths: reader.positionalsFrom(0),
        permanent: reader.flag("permanent"),
        dryRun: reader.flag("dry-run"),
        yes: reader.flag("yes"),
        confirm: reader.string("confirm"),
        all: reader.flag("all"),
      };
    },
  },
};

export class DeletePaths implements Command<DeleteInput, DeleteOutput> {
  readonly spec = deleteSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly trash: Trash,
    private readonly protectedPaths: ProtectedPaths,
  ) {}

  async execute(input: DeleteInput, context: CommandContext): Promise<CommandResult<DeleteOutput>> {
    const paths = outermost(await expandPaths(this.fileSystem, input.paths, context.cwd, input.all));
    refuseProtected(this.protectedPaths, paths, context.cwd);

    const planned: DeletionItem[] = [];
    const warnings: Message[] = [];
    for (const target of paths) {
      const stat = await this.fileSystem.lstat(target);
      const size = await measure(this.fileSystem, target);
      const isRepository =
        stat?.kind === "directory" && (await this.fileSystem.lstat(path.join(target, ".git"))) !== null;
      if (isRepository) warnings.push(message("files.delete.repository", { path: target }));
      planned.push({
        path: target,
        kind: stat?.kind ?? "other",
        bytes: size.bytes,
        files: size.files,
        isRepository,
        outcome: "planned",
        reason: null,
      });
    }
    const bytes = planned.reduce((sum, item) => sum + item.bytes, 0);
    const mode = input.permanent ? "permanent" : "trash";
    if (input.dryRun) return preview({ mode, items: planned, bytes }, "", warnings);

    if (input.permanent) {
      const warning = message("files.delete.warn-permanent", { count: planned.length, size: formatBytes(bytes) });
      await requireTypedConfirmation(context, warning, String(planned.length), input.confirm);
      return this.finish(mode, await this.removeAll(planned), bytes, warnings);
    }

    const question = message("files.delete.ask-trash", {
      count: planned.length,
      location: message(this.trash.location),
    });
    await requireApproval(context, question, input.yes);
    const outcomes = await this.trash.send(planned.map((item) => item.path));
    const items = planned.map((item, index): DeletionItem => {
      const outcome = outcomes[index];
      if (outcome?.ok === true) return { ...item, outcome: "trashed" };
      return {
        ...item,
        outcome: "failed",
        reason: outcome?.ok === false ? outcome.reason : message("core.trash.failed", { detail: "no result" }),
      };
    });
    return this.finish(mode, items, bytes, warnings);
  }

  private async removeAll(planned: readonly DeletionItem[]): Promise<DeletionItem[]> {
    const items: DeletionItem[] = [];
    for (const item of planned) {
      try {
        await this.fileSystem.remove(item.path);
        items.push({ ...item, outcome: "deleted" });
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        items.push({ ...item, outcome: "failed", reason: error.detail });
      }
    }
    return items;
  }

  private finish(
    mode: DeleteOutput["mode"],
    items: readonly DeletionItem[],
    bytes: number,
    warnings: readonly Message[],
  ): CommandResult<DeleteOutput> {
    // A reason from the file system already names its path; a trash reason does not.
    const failures = items
      .filter((item) => item.outcome === "failed")
      .map((item) => {
        const reason = item.reason ?? message("core.trash.failed", { detail: "" });
        return "path" in reason.params ? reason : message("files.delete.failed", { path: item.path, reason });
      });
    return done({ mode, items, bytes }, { warnings, failures });
  }
}

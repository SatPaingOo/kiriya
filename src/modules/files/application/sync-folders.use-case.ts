import path from "node:path";
import { isInside } from "../../../core/application/paths.js";
import { requireApproval, requireTypedConfirmation } from "../../../core/application/safety.js";
import { walk } from "../../../core/application/walk.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import {
  KiriyaError,
  NotFoundError,
  OperationFailedError,
  RefusedError,
  UsageError,
} from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { planSync, type FileSnapshot, type TreeSnapshot } from "../domain/sync-plan.js";

export interface SyncInput {
  readonly source: string;
  readonly target: string;
  readonly withDelete: boolean;
  readonly apply: boolean;
  readonly yes: boolean;
  readonly confirm: string | undefined;
}

export interface SyncOutput {
  readonly source: string;
  readonly target: string;
  /** Relative paths with `/`. */
  readonly copy: readonly string[];
  readonly update: readonly string[];
  readonly remove: readonly string[];
  readonly bytes: number;
  readonly applied: boolean;
}

const osPath = (root: string, rel: string): string => path.join(root, ...rel.split("/"));

export const syncSpec: CommandSpec<SyncInput> = {
  id: "files.sync",
  summary: "files.sync.summary",
  examples: [
    "kiriya files sync photos E:/backup/photos",
    "kiriya files sync site dist --apply",
    "kiriya files sync docs ../mirror/docs --delete --apply",
  ],
  safety: "destroy",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "source", description: "files.sync.arg.source", required: true, variadic: false, path: true },
      { name: "target", description: "files.sync.arg.target", required: true, variadic: false, path: true },
    ],
    options: {
      delete: { type: "boolean", description: "files.sync.option.delete" },
      apply: { type: "boolean", description: "files.sync.option.apply" },
      yes: { type: "boolean", description: "files.sync.option.yes", short: "y", terminalOnly: true },
      confirm: { type: "string", description: "files.sync.option.confirm", valueName: "<name>", terminalOnly: true },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        source: reader.positional(0) ?? "",
        target: reader.positional(1) ?? "",
        withDelete: reader.flag("delete"),
        apply: reader.flag("apply"),
        yes: reader.flag("yes"),
        confirm: reader.string("confirm"),
      };
    },
  },
};

export class SyncFolders implements Command<SyncInput, SyncOutput> {
  readonly spec = syncSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly environment: Environment,
  ) {}

  async execute(input: SyncInput, context: CommandContext): Promise<CommandResult<SyncOutput>> {
    const source = path.resolve(context.cwd, input.source);
    const target = path.resolve(context.cwd, input.target);
    await this.checkPair(source, target);

    const plan = planSync(await this.snapshot(source), await this.snapshot(target), input.withDelete);
    const data: SyncOutput = {
      source,
      target,
      copy: plan.copy,
      update: plan.update,
      remove: plan.remove,
      bytes: plan.bytes,
      applied: false,
    };
    if (plan.copy.length + plan.update.length + plan.remove.length === 0) return done(data);
    if (!input.apply) return preview(data, "--apply");

    if (plan.remove.length > 0) {
      const warning = message("files.sync.warn-delete", { count: plan.remove.length, target });
      await requireTypedConfirmation(context, warning, path.basename(target), input.confirm);
    } else {
      const question = message("files.sync.ask", { count: plan.copy.length + plan.update.length, target });
      await requireApproval(context, question, input.yes);
    }

    const failures: Message[] = [];
    for (const rel of [...plan.copy, ...plan.update]) {
      if (context.signal.aborted) break;
      const to = osPath(target, rel);
      try {
        await this.fileSystem.createDirectory(path.dirname(to));
        // Copying keeps the source's modification time, so the next sync sees the file as unchanged.
        await this.fileSystem.copy(osPath(source, rel), to, true);
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        failures.push(error.detail);
      }
    }
    for (const rel of plan.remove) {
      const doomed = osPath(target, rel);
      if (!isInside(doomed, target)) throw new OperationFailedError("files.sync.outside", { path: doomed });
      try {
        await this.fileSystem.remove(doomed);
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        if (!(error instanceof NotFoundError)) failures.push(error.detail);
      }
    }
    for (const rel of plan.removeDirectories) {
      try {
        await this.fileSystem.removeEmptyDirectory(osPath(target, rel));
      } catch (error) {
        // A folder that cannot go is left in place; the files that mattered are already handled.
        if (!(error instanceof KiriyaError)) throw error;
      }
    }
    return done({ ...data, applied: true }, { failures });
  }

  /** Refuses pairs where a sync could clobber the source, or wipe a drive or a home folder by mistake. */
  private async checkPair(source: string, target: string): Promise<void> {
    if ((await this.fileSystem.stat(source))?.kind !== "directory") {
      throw new UsageError("files.sync.source-not-folder", { path: source });
    }
    if (isInside(target, source) || isInside(source, target)) throw new UsageError("files.sync.nested");
    if (target === path.parse(target).root) {
      throw new RefusedError("core.guard.refused", {
        path: target,
        reason: message("core.guard.drive-root", { path: target }),
      });
    }
    if (target.toLowerCase() === path.resolve(this.environment.homeDirectory).toLowerCase()) {
      throw new RefusedError("core.guard.refused", {
        path: target,
        reason: message("core.guard.home", { path: target }),
      });
    }
  }

  /** Files and folders below root; symlinks are left out. A missing root is empty. */
  private async snapshot(root: string): Promise<TreeSnapshot> {
    const files = new Map<string, FileSnapshot>();
    const directories = new Set<string>();
    if ((await this.fileSystem.stat(root))?.kind !== "directory") return { files, directories };
    for await (const entry of walk(this.fileSystem, root, { all: true })) {
      if (entry.kind === "directory") {
        directories.add(entry.rel);
      } else if (entry.kind === "file") {
        const stat = await this.fileSystem.lstat(entry.path);
        if (stat !== null) files.set(entry.rel, { size: stat.size, modifiedMs: stat.modifiedMs });
      }
    }
    return { files, directories };
  }
}

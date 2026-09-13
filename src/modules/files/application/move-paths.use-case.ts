import path from "node:path";
import { refuseProtected, requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import { KiriyaError } from "../../../core/domain/errors.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProtectedPaths } from "../../../core/domain/ports/protected-paths.js";
import type { Trash } from "../../../core/domain/ports/trash.js";
import { transferInput, type TransferInput } from "./copy-paths.use-case.js";
import { moveEntry } from "./move-entry.js";
import { planTransfers } from "./transfers.js";

export interface MoveItem {
  readonly source: string;
  readonly destination: string;
  readonly conflict: boolean;
  readonly outcome: "planned" | "moved" | "failed";
  readonly reason: Message | null;
}

export interface MoveOutput {
  readonly items: readonly MoveItem[];
  readonly conflicts: number;
}

export const moveSpec: CommandSpec<TransferInput> = {
  id: "files.move",
  summary: "files.move.summary",
  examples: [
    "kiriya files move draft.md docs/",
    "kiriya files move readme.md README.md",
    'kiriya files move "*.log" D:/archive/logs/ --dry-run',
  ],
  // Replaced destinations go to the trash, so even --overwrite can be undone.
  safety: "write",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: transferInput,
};

export class MovePaths implements Command<TransferInput, MoveOutput> {
  readonly spec = moveSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly trash: Trash,
    private readonly protectedPaths: ProtectedPaths,
    private readonly environment: Environment,
  ) {}

  async execute(input: TransferInput, context: CommandContext): Promise<CommandResult<MoveOutput>> {
    const windows = this.environment.os === "windows";
    const transfers = await planTransfers(this.fileSystem, input.sources, input.target, context.cwd, windows);
    refuseProtected(
      this.protectedPaths,
      transfers.map((transfer) => transfer.source),
      context.cwd,
    );
    const planned = transfers.map((transfer): MoveItem => ({ ...transfer, outcome: "planned", reason: null }));
    const conflicts = planned.filter((item) => item.conflict);
    const data: MoveOutput = { items: planned, conflicts: conflicts.length };
    if (input.dryRun) return preview(data, "");

    if (conflicts.length > 0) {
      if (!input.overwrite) {
        return done(data, {
          failures: conflicts.map((item) => message("core.fs.exists", { path: item.destination })),
          warnings: [message("files.transfer.nothing-changed")],
        });
      }
      const destinations = conflicts.map((item) => item.destination);
      refuseProtected(this.protectedPaths, destinations, context.cwd);
      const warning = message("files.move.warn-overwrite", {
        count: conflicts.length,
        location: message(this.trash.location),
      });
      await requireTypedConfirmation(context, warning, String(conflicts.length), input.confirm);
      const outcomes = await this.trash.send(destinations);
      const refused = outcomes.flatMap((outcome) =>
        outcome.ok ? [] : [message("files.move.trash-failed", { path: outcome.path, reason: outcome.reason })],
      );
      if (refused.length > 0) return done(data, { failures: refused, warnings: [message("files.move.nothing-moved")] });
    }

    const items: MoveItem[] = [];
    const failures: Message[] = [];
    for (const item of planned) {
      try {
        await this.fileSystem.createDirectory(path.dirname(item.destination));
        await moveEntry(this.fileSystem, item.source, item.destination);
        items.push({ ...item, outcome: "moved" });
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        items.push({ ...item, outcome: "failed", reason: error.detail });
        failures.push(error.detail);
      }
    }
    return done({ ...data, items }, { failures });
  }
}

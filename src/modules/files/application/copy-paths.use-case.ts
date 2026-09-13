import path from "node:path";
import { measure } from "../../../core/application/paths.js";
import { refuseProtected, requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import { KiriyaError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProtectedPaths } from "../../../core/domain/ports/protected-paths.js";
import { planTransfers } from "./transfers.js";

export interface TransferInput {
  readonly sources: readonly string[];
  readonly target: string;
  readonly overwrite: boolean;
  readonly dryRun: boolean;
  readonly confirm: string | undefined;
}

export interface CopyItem {
  readonly source: string;
  readonly destination: string;
  readonly bytes: number;
  readonly conflict: boolean;
  readonly outcome: "planned" | "copied" | "failed";
  readonly reason: Message | null;
}

export interface CopyOutput {
  readonly items: readonly CopyItem[];
  readonly bytes: number;
  readonly conflicts: number;
}

/** The arguments and flags copy and move share. */
export const transferInput: CommandSpec<TransferInput>["input"] = {
  positionals: [
    { name: "sources", description: "files.transfer.arg.sources", required: true, variadic: true },
    { name: "target", description: "files.transfer.arg.target", required: true, variadic: false },
  ],
  options: {
    overwrite: { type: "boolean", description: "files.transfer.option.overwrite" },
    "dry-run": { type: "boolean", description: "files.transfer.option.dry-run" },
    confirm: { type: "string", description: "files.transfer.option.confirm", valueName: "<count>" },
  },
  parse(raw) {
    const reader = new RawReader(raw);
    const positionals = reader.positionalsFrom(0);
    return {
      sources: positionals.slice(0, -1),
      target: positionals.at(-1) ?? "",
      overwrite: reader.flag("overwrite"),
      dryRun: reader.flag("dry-run"),
      confirm: reader.string("confirm"),
    };
  },
};

export const copySpec: CommandSpec<TransferInput> = {
  id: "files.copy",
  summary: "files.copy.summary",
  examples: [
    "kiriya files copy report.txt backup/",
    'kiriya files copy "src/**/*.ts" snapshot/ --dry-run',
    "kiriya files copy config.json config.old.json",
  ],
  safety: "destroy",
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: transferInput,
};

export class CopyPaths implements Command<TransferInput, CopyOutput> {
  readonly spec = copySpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly protectedPaths: ProtectedPaths,
    private readonly environment: Environment,
  ) {}

  async execute(input: TransferInput, context: CommandContext): Promise<CommandResult<CopyOutput>> {
    const windows = this.environment.os === "windows";
    const transfers = await planTransfers(this.fileSystem, input.sources, input.target, context.cwd, windows);
    const planned: CopyItem[] = [];
    for (const transfer of transfers) {
      const { bytes } = await measure(this.fileSystem, transfer.source);
      planned.push({ ...transfer, bytes, outcome: "planned", reason: null });
    }
    const conflicts = planned.filter((item) => item.conflict);
    const data: CopyOutput = {
      items: planned,
      bytes: planned.reduce((sum, item) => sum + item.bytes, 0),
      conflicts: conflicts.length,
    };
    if (input.dryRun) return preview(data, "");

    if (conflicts.length > 0) {
      if (!input.overwrite) {
        return done(data, {
          failures: conflicts.map((item) => message("core.fs.exists", { path: item.destination })),
          warnings: [message("files.transfer.nothing-changed")],
        });
      }
      refuseProtected(
        this.protectedPaths,
        conflicts.map((item) => item.destination),
        context.cwd,
      );
      const warning = message("files.copy.warn-overwrite", { count: conflicts.length });
      await requireTypedConfirmation(context, warning, String(conflicts.length), input.confirm);
    }

    const items: CopyItem[] = [];
    const failures: Message[] = [];
    for (const item of planned) {
      try {
        await this.fileSystem.createDirectory(path.dirname(item.destination));
        await this.fileSystem.copy(item.source, item.destination, input.overwrite);
        items.push({ ...item, outcome: "copied" });
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        items.push({ ...item, outcome: "failed", reason: error.detail });
        failures.push(error.detail);
      }
    }
    return done({ ...data, items }, { failures });
  }
}

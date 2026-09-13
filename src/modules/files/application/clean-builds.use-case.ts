import path from "node:path";
import { CLEAN_RULES, type CleanRule } from "../../../config/clean-rules.js";
import { measure } from "../../../core/application/paths.js";
import { refuseProtected, requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import { KiriyaError, NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import { byCodePoint } from "../../../core/domain/names.js";
import type { DirectoryEntry, FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import type { ProtectedPaths } from "../../../core/domain/ports/protected-paths.js";
import { formatBytes } from "../../../core/domain/values/bytes.js";

export interface CleanInput {
  readonly folder: string;
  readonly depth: number;
  readonly apply: boolean;
  readonly confirm: string | undefined;
}

export interface CleanCandidate {
  readonly path: string;
  /** What recreates the folder. */
  readonly reason: Message;
  readonly bytes: number;
}

export interface CleanOutput {
  readonly folder: string;
  /** Largest first. */
  readonly candidates: readonly CleanCandidate[];
  readonly bytes: number;
  /** Matching folders left alone because git tracks files in them. */
  readonly tracked: number;
  readonly removed: number;
}

function ruleFor(name: string, siblings: readonly string[]): CleanRule | undefined {
  return CLEAN_RULES.find((rule) => {
    const sibling = rule.sibling;
    return rule.directories.includes(name) && (sibling === null || siblings.some((item) => sibling.test(item)));
  });
}

export const cleanSpec: CommandSpec<CleanInput> = {
  id: "files.clean",
  summary: "files.clean.summary",
  examples: ["kiriya files clean ~/projects", "kiriya files clean --apply", "kiriya files clean . --depth 3 --json"],
  safety: "destroy",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "folder", description: "files.clean.arg.folder", required: false, variadic: false, path: true },
    ],
    options: {
      depth: { type: "string", description: "files.clean.option.depth", valueName: "<n>" },
      apply: { type: "boolean", description: "files.clean.option.apply" },
      confirm: { type: "string", description: "files.clean.option.confirm", valueName: "<count>", terminalOnly: true },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        folder: reader.positional(0) ?? ".",
        depth: reader.positiveInteger("depth", 8),
        apply: reader.flag("apply"),
        confirm: reader.string("confirm"),
      };
    },
  },
};

export class CleanBuilds implements Command<CleanInput, CleanOutput> {
  readonly spec = cleanSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly processRunner: ProcessRunner,
    private readonly protectedPaths: ProtectedPaths,
  ) {}

  async execute(input: CleanInput, context: CommandContext): Promise<CommandResult<CleanOutput>> {
    const folder = path.resolve(context.cwd, input.folder);
    const stat = await this.fileSystem.stat(folder);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: folder });
    if (stat.kind !== "directory") throw new NotFoundError("core.path.not-a-folder", { path: folder });

    const git = await this.processRunner.find("git");
    const candidates: CleanCandidate[] = [];
    let tracked = 0;
    const visit = async (dir: string, depth: number): Promise<void> => {
      let entries: readonly DirectoryEntry[];
      try {
        entries = await this.fileSystem.readDirectory(dir);
      } catch (error) {
        if (error instanceof KiriyaError) return;
        throw error;
      }
      const siblings = entries.map((entry) => entry.name);
      for (const entry of entries) {
        if (context.signal.aborted) return;
        if (entry.kind !== "directory" || entry.name === ".git") continue;
        const entryPath = path.join(dir, entry.name);
        const rule = ruleFor(entry.name, siblings);
        if (rule === undefined) {
          // An unrecognised node_modules is still not worth walking into.
          if (entry.name !== "node_modules" && depth < input.depth) await visit(entryPath, depth + 1);
          continue;
        }
        if (git !== null && (await this.insideRepository(dir))) {
          const listed = await this.processRunner.run(git, ["-C", dir, "ls-files", "--", entry.name], {
            timeoutMs: 60_000,
            signal: context.signal,
          });
          if (listed.code === 0 && listed.stdout.trim() !== "") {
            tracked += 1;
            continue;
          }
        }
        const { bytes } = await measure(this.fileSystem, entryPath);
        candidates.push({ path: entryPath, reason: message(rule.reason), bytes });
      }
    };
    await visit(folder, 1);
    candidates.sort((a, b) => b.bytes - a.bytes || byCodePoint(a.path, b.path));

    const bytes = candidates.reduce((sum, candidate) => sum + candidate.bytes, 0);
    const warnings = git === null ? [message("files.clean.no-git")] : [];
    const data: CleanOutput = { folder, candidates, bytes, tracked, removed: 0 };
    if (candidates.length === 0) return done(data, { warnings });
    if (!input.apply) return preview(data, "--apply", warnings);

    refuseProtected(
      this.protectedPaths,
      candidates.map((candidate) => candidate.path),
      context.cwd,
    );
    // Everything here is rebuildable, so it is removed for good rather than filling the trash.
    const warning = message("files.clean.warn", { count: candidates.length, size: formatBytes(bytes) });
    await requireTypedConfirmation(context, warning, String(candidates.length), input.confirm);
    const failures: Message[] = [];
    let removed = 0;
    for (const candidate of candidates) {
      try {
        await this.fileSystem.remove(candidate.path);
        removed += 1;
      } catch (error) {
        if (!(error instanceof KiriyaError)) throw error;
        failures.push(error.detail);
      }
    }
    return done({ ...data, removed }, { warnings, failures });
  }

  private async insideRepository(folder: string): Promise<boolean> {
    for (let current = folder; ;) {
      try {
        if ((await this.fileSystem.lstat(path.join(current, ".git"))) !== null) return true;
      } catch (error) {
        if (error instanceof KiriyaError) return false;
        throw error;
      }
      const parent = path.dirname(current);
      if (parent === current) return false;
      current = parent;
    }
  }
}

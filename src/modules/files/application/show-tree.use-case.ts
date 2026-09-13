import path from "node:path";
import { DEPENDENCY_DIRECTORIES } from "../../../config/dependency-directories.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { KiriyaError, NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { byCodePoint, isHiddenName } from "../../../core/domain/names.js";
import type { EntryKind, FileSystem } from "../../../core/domain/ports/file-system.js";

export interface TreeInput {
  readonly path: string;
  readonly depth: number;
  readonly all: boolean;
}

export interface TreeNode {
  readonly name: string;
  readonly kind: EntryKind;
  readonly target: string | null;
  /** A dependency or build folder that is listed but not opened without --all. */
  readonly closed: boolean;
  readonly unreadable: boolean;
  readonly children: readonly TreeNode[];
}

export interface TreeOutput {
  readonly root: string;
  readonly depth: number;
  readonly nodes: readonly TreeNode[];
  readonly directories: number;
  readonly files: number;
}

export const treeSpec: CommandSpec<TreeInput> = {
  id: "files.tree",
  summary: "files.tree.summary",
  examples: ["kiriya files tree", "kiriya files tree src --depth 5", "kiriya files tree --all --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "path", description: "files.tree.arg.path", required: false, variadic: false, path: true }],
    options: {
      depth: { type: "string", description: "files.tree.option.depth", valueName: "<n>" },
      all: { type: "boolean", description: "files.tree.option.all" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { path: reader.positional(0) ?? ".", depth: reader.positiveInteger("depth", 3), all: reader.flag("all") };
    },
  },
};

export class ShowTree implements Command<TreeInput, TreeOutput> {
  readonly spec = treeSpec;

  constructor(private readonly fileSystem: FileSystem) {}

  async execute(input: TreeInput, context: CommandContext): Promise<CommandResult<TreeOutput>> {
    const root = path.resolve(context.cwd, input.path);
    const stat = await this.fileSystem.stat(root);
    if (stat === null) throw new NotFoundError("core.fs.not-found", { path: root });
    if (stat.kind !== "directory") throw new NotFoundError("core.path.not-a-folder", { path: root });
    const counts = { directories: 0, files: 0 };
    const nodes = await this.children(root, 1, input, counts);
    return done({ root, depth: input.depth, nodes, ...counts });
  }

  private async children(
    folder: string,
    depth: number,
    input: TreeInput,
    counts: { directories: number; files: number },
  ): Promise<TreeNode[]> {
    const entries = [...(await this.fileSystem.readDirectory(folder))]
      .filter((entry) => input.all || !isHiddenName(entry.name))
      .sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory") || byCodePoint(a.name, b.name));
    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      const entryPath = path.join(folder, entry.name);
      const isFolder = entry.kind === "directory";
      const closed = isFolder && !input.all && DEPENDENCY_DIRECTORIES.has(entry.name);
      if (isFolder) counts.directories += 1;
      else counts.files += 1;

      let children: TreeNode[] = [];
      let unreadable = false;
      if (isFolder && !closed && depth < input.depth) {
        try {
          children = await this.children(entryPath, depth + 1, input, counts);
        } catch (error) {
          if (!(error instanceof KiriyaError)) throw error;
          unreadable = true;
        }
      }
      const target = entry.kind === "symlink" ? await this.fileSystem.readLink(entryPath) : null;
      nodes.push({ name: entry.name, kind: entry.kind, target, closed, unreadable, children });
    }
    return nodes;
  }
}

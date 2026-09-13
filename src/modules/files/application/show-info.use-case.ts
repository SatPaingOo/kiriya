import path from "node:path";
import { expandPaths, measure } from "../../../core/application/paths.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { isHiddenName } from "../../../core/domain/names.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { EntryKind, FileSystem } from "../../../core/domain/ports/file-system.js";
import { HASH_ALGORITHMS, type HashAlgorithm, type Hasher } from "../../../core/domain/ports/hasher.js";

export interface InfoInput {
  readonly paths: readonly string[];
  readonly hash: HashAlgorithm | undefined;
}

export interface InfoItem {
  readonly path: string;
  readonly kind: EntryKind;
  readonly target: string | null;
  readonly bytes: number;
  /** What a folder holds; null for anything else. */
  readonly contents: { readonly files: number; readonly directories: number } | null;
  readonly createdMs: number;
  readonly modifiedMs: number;
  readonly accessedMs: number;
  /** The owner may write. */
  readonly writable: boolean;
  /** As `rwxr-xr-x` and `755`; null on Windows, which keeps no such bits. */
  readonly permissions: { readonly symbolic: string; readonly octal: string } | null;
  readonly hidden: boolean;
  readonly hash: { readonly algorithm: HashAlgorithm; readonly value: string } | null;
}

export interface InfoOutput {
  readonly items: readonly InfoItem[];
}

function symbolic(mode: number): string {
  let text = "";
  for (const shift of [6, 3, 0]) {
    ["r", "w", "x"].forEach((bit, index) => {
      text += mode & (1 << (shift + 2 - index)) ? bit : "-";
    });
  }
  return text;
}

export const infoSpec: CommandSpec<InfoInput> = {
  id: "files.info",
  summary: "files.info.summary",
  examples: [
    "kiriya files info package.json",
    "kiriya files info src --json",
    'kiriya files info "dist/*.zip" --hash sha256',
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "paths", description: "files.info.arg.paths", required: true, variadic: true }],
    options: {
      hash: { type: "string", description: "files.info.option.hash", valueName: `<${HASH_ALGORITHMS.join("|")}>` },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const hash = reader.string("hash") === undefined ? undefined : reader.choice("hash", HASH_ALGORITHMS, "sha256");
      return { paths: reader.positionalsFrom(0), hash };
    },
  },
};

export class ShowInfo implements Command<InfoInput, InfoOutput> {
  readonly spec = infoSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly hasher: Hasher,
    private readonly environment: Environment,
  ) {}

  async execute(input: InfoInput, context: CommandContext): Promise<CommandResult<InfoOutput>> {
    const items: InfoItem[] = [];
    for (const target of await expandPaths(this.fileSystem, input.paths, context.cwd, false)) {
      const stat = await this.fileSystem.lstat(target);
      if (stat === null) continue;
      const size = stat.kind === "directory" ? await measure(this.fileSystem, target) : null;
      const hash =
        input.hash !== undefined && stat.kind === "file"
          ? { algorithm: input.hash, value: await this.hasher.hashFile(target, input.hash) }
          : null;
      items.push({
        path: target,
        kind: stat.kind,
        target: stat.kind === "symlink" ? await this.fileSystem.readLink(target) : null,
        bytes: size === null ? stat.size : size.bytes,
        contents: size === null ? null : { files: size.files, directories: size.directories },
        createdMs: stat.createdMs,
        modifiedMs: stat.modifiedMs,
        accessedMs: stat.accessedMs,
        writable: (stat.mode & 0o200) !== 0,
        permissions:
          this.environment.os === "windows"
            ? null
            : { symbolic: symbolic(stat.mode), octal: (stat.mode & 0o777).toString(8).padStart(3, "0") },
        hidden: isHiddenName(path.basename(target)),
        hash,
      });
    }
    return done({ items });
  }
}

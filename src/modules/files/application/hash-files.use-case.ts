import { expandPaths } from "../../../core/application/paths.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { HASH_ALGORITHMS, type HashAlgorithm, type Hasher } from "../../../core/domain/ports/hasher.js";

export interface HashInput {
  readonly paths: readonly string[];
  readonly algorithm: HashAlgorithm;
  /** Lower case. */
  readonly check: string | undefined;
}

export interface HashedFile {
  readonly path: string;
  readonly hash: string;
}

export interface HashCheck {
  readonly path: string;
  readonly expected: string;
  readonly actual: string;
  readonly matches: boolean;
}

export interface HashOutput {
  readonly algorithm: HashAlgorithm;
  readonly files: readonly HashedFile[];
  readonly check: HashCheck | null;
}

export const hashSpec: CommandSpec<HashInput> = {
  id: "files.hash",
  summary: "files.hash.summary",
  examples: [
    "kiriya files hash setup.exe",
    'kiriya files hash "dist/*" --algo sha512',
    "kiriya files hash node.tar.gz --check <expected-sha256>",
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "paths", description: "files.hash.arg.paths", required: true, variadic: true, path: true }],
    options: {
      algo: { type: "string", description: "files.hash.option.algo", choices: HASH_ALGORITHMS },
      check: { type: "string", description: "files.hash.option.check", valueName: "<hex>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        paths: reader.positionalsFrom(0),
        algorithm: reader.choice("algo", HASH_ALGORITHMS, "sha256"),
        check: reader.string("check")?.trim().toLowerCase(),
      };
    },
  },
};

export class HashFiles implements Command<HashInput, HashOutput> {
  readonly spec = hashSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly hasher: Hasher,
  ) {}

  async execute(input: HashInput, context: CommandContext): Promise<CommandResult<HashOutput>> {
    const warnings: Message[] = [];
    const files: string[] = [];
    for (const target of await expandPaths(this.fileSystem, input.paths, context.cwd, false)) {
      if ((await this.fileSystem.lstat(target))?.kind === "file") files.push(target);
      else warnings.push(message("files.hash.not-a-file", { path: target }));
    }

    if (input.check !== undefined) {
      const [file, ...rest] = files;
      if (file === undefined || rest.length > 0) throw new UsageError("files.hash.check-one");
      const actual = await this.hasher.hashFile(file, input.algorithm);
      const matches = actual === input.check;
      const failures = matches
        ? []
        : [message("files.hash.mismatch", { algorithm: input.algorithm, expected: input.check, actual })];
      const check = { path: file, expected: input.check, actual, matches };
      return done({ algorithm: input.algorithm, files: [{ path: file, hash: actual }], check }, { warnings, failures });
    }

    const hashed: HashedFile[] = [];
    for (const file of files) {
      if (context.signal.aborted) break;
      hashed.push({ path: file, hash: await this.hasher.hashFile(file, input.algorithm) });
    }
    return done({ algorithm: input.algorithm, files: hashed, check: null }, { warnings });
  }
}

import path from "node:path";
import { walk } from "../../../core/application/walk.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError, UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import { byCodePoint } from "../../../core/domain/names.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { Hasher } from "../../../core/domain/ports/hasher.js";
import type { TextEncoding } from "../domain/text-encoding.js";
import { readTextFile } from "./text-files.js";

export interface CompareInput {
  readonly a: string;
  readonly b: string;
  readonly all: boolean;
}

export interface TextDifference {
  /** Equal once line endings are ignored: only line endings or the encoding differ. */
  readonly sameText: boolean;
  readonly encodingA: TextEncoding;
  readonly encodingB: TextEncoding;
  /** The first line that differs, from 1. */
  readonly line: number;
  readonly linesA: number;
  readonly linesB: number;
  /** null past the end of the file. */
  readonly lineA: string | null;
  readonly lineB: string | null;
}

export interface CompareFilesOutput {
  readonly kind: "files";
  readonly a: string;
  readonly b: string;
  readonly identical: boolean;
  readonly sizeA: number;
  readonly sizeB: number;
  /** null when identical, or when either file is not text. */
  readonly text: TextDifference | null;
}

export interface FolderDifference {
  /** Relative, with `/`. */
  readonly path: string;
  /** `kind`: a file on one side, a folder on the other. */
  readonly reason: "content" | "kind";
}

export interface CompareFoldersOutput {
  readonly kind: "folders";
  readonly a: string;
  readonly b: string;
  readonly entries: number;
  readonly onlyInA: readonly string[];
  readonly onlyInB: readonly string[];
  readonly different: readonly FolderDifference[];
}

export type CompareOutput = CompareFilesOutput | CompareFoldersOutput;

interface ScannedEntry {
  readonly path: string;
  readonly isDirectory: boolean;
  readonly size: number;
}

export const compareSpec: CommandSpec<CompareInput> = {
  id: "files.compare",
  summary: "files.compare.summary",
  examples: [
    "kiriya files compare appsettings.json appsettings.Production.json",
    "kiriya files compare dist backup/dist",
    "kiriya files compare a b --all --json",
  ],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "a", description: "files.compare.arg.a", required: true, variadic: false },
      { name: "b", description: "files.compare.arg.b", required: true, variadic: false },
    ],
    options: { all: { type: "boolean", description: "files.compare.option.all" } },
    parse(raw) {
      const reader = new RawReader(raw);
      return { a: reader.positional(0) ?? "", b: reader.positional(1) ?? "", all: reader.flag("all") };
    },
  },
};

export class ComparePaths implements Command<CompareInput, CompareOutput> {
  readonly spec = compareSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly hasher: Hasher,
  ) {}

  async execute(input: CompareInput, context: CommandContext): Promise<CommandResult<CompareOutput>> {
    const a = path.resolve(context.cwd, input.a);
    const b = path.resolve(context.cwd, input.b);
    const statA = await this.fileSystem.lstat(a);
    if (statA === null) throw new NotFoundError("core.fs.not-found", { path: a });
    const statB = await this.fileSystem.lstat(b);
    if (statB === null) throw new NotFoundError("core.fs.not-found", { path: b });
    if ((statA.kind === "directory") !== (statB.kind === "directory")) throw new UsageError("files.compare.mixed");

    const output: CompareOutput =
      statA.kind === "directory"
        ? await this.compareFolders(a, b, input.all)
        : await this.compareFiles(a, b, statA.size, statB.size);
    const same =
      output.kind === "files"
        ? output.identical
        : output.onlyInA.length + output.onlyInB.length + output.different.length === 0;
    // Like diff and cmp, a difference is exit code 1.
    return done(output, { failures: same ? [] : [message("files.compare.different")] });
  }

  private async sameContent(a: string, b: string, sizeA: number, sizeB: number): Promise<boolean> {
    if (sizeA !== sizeB) return false;
    return (await this.hasher.hashFile(a, "sha256")) === (await this.hasher.hashFile(b, "sha256"));
  }

  private async compareFiles(a: string, b: string, sizeA: number, sizeB: number): Promise<CompareFilesOutput> {
    const base = { kind: "files", a, b, sizeA, sizeB } as const;
    if (await this.sameContent(a, b, sizeA, sizeB)) return { ...base, identical: true, text: null };
    const textA = await readTextFile(this.fileSystem, this.content, a);
    const textB = await readTextFile(this.fileSystem, this.content, b);
    if (textA === null || textB === null) return { ...base, identical: false, text: null };

    const linesA = textA.text.split(/\r?\n/);
    const linesB = textB.text.split(/\r?\n/);
    const index = linesA.findIndex((line, position) => line !== linesB[position]);
    const at = index < 0 ? linesA.length : index;
    return {
      ...base,
      identical: false,
      text: {
        sameText: textA.text.replace(/\r\n/g, "\n") === textB.text.replace(/\r\n/g, "\n"),
        encodingA: textA.encoding,
        encodingB: textB.encoding,
        line: at + 1,
        linesA: linesA.length,
        linesB: linesB.length,
        lineA: linesA[at] ?? null,
        lineB: linesB[at] ?? null,
      },
    };
  }

  private async scan(root: string, all: boolean): Promise<Map<string, ScannedEntry>> {
    const entries = new Map<string, ScannedEntry>();
    for await (const entry of walk(this.fileSystem, root, { all })) {
      const isDirectory = entry.kind === "directory";
      const stat = isDirectory ? null : await this.fileSystem.lstat(entry.path);
      if (!isDirectory && stat === null) continue;
      entries.set(entry.rel, { path: entry.path, isDirectory, size: stat?.size ?? 0 });
    }
    return entries;
  }

  private async compareFolders(a: string, b: string, all: boolean): Promise<CompareFoldersOutput> {
    const left = await this.scan(a, all);
    const right = await this.scan(b, all);
    const onlyInA = [...left.keys()].filter((rel) => !right.has(rel)).sort(byCodePoint);
    const onlyInB = [...right.keys()].filter((rel) => !left.has(rel)).sort(byCodePoint);
    const different: FolderDifference[] = [];
    for (const [rel, entry] of left) {
      const other = right.get(rel);
      if (other === undefined) continue;
      if (entry.isDirectory !== other.isDirectory) {
        different.push({ path: rel, reason: "kind" });
      } else if (!entry.isDirectory && !(await this.sameContent(entry.path, other.path, entry.size, other.size))) {
        different.push({ path: rel, reason: "content" });
      }
    }
    different.sort((x, y) => byCodePoint(x.path, y.path));
    return { kind: "folders", a, b, entries: left.size, onlyInA, onlyInB, different };
  }
}

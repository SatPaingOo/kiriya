import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import { comparableFolder, entryFolder, isAbsoluteFolder, listSeparator } from "./path-entries.js";

export type PathEntryStatus = "ok" | "missing" | "not-a-folder" | "duplicate" | "empty" | "relative";

export interface PathEntry {
  /** From 1, in the order the OS searches. */
  readonly index: number;
  readonly entry: string;
  /** The folder the entry names, after quotes and `%NAME%` on Windows. */
  readonly folder: string;
  readonly status: PathEntryStatus;
  /** The earlier entry this one repeats. */
  readonly duplicateOf: number | null;
}

export interface PathInput {
  readonly variable: string;
}

export interface PathOutput {
  readonly variable: string;
  readonly separator: string;
  readonly entries: readonly PathEntry[];
}

export const pathSpec: CommandSpec<PathInput> = {
  id: "env.path",
  summary: "env.path.summary",
  examples: ["kiriya env path", "kiriya env path PYTHONPATH --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "variable", description: "env.path.arg.variable", required: false, variadic: false }],
    options: {},
    parse: (raw) => ({ variable: new RawReader(raw).positional(0) ?? "PATH" }),
  },
};

export class InspectPath implements Command<PathInput, PathOutput> {
  readonly spec = pathSpec;

  constructor(
    private readonly environment: Environment,
    private readonly fileSystem: FileSystem,
  ) {}

  async execute(input: PathInput): Promise<CommandResult<PathOutput>> {
    const os = this.environment.os;
    const variable = this.nameOnThisOs(input.variable);
    const value = this.environment.variable(variable);
    if (value === undefined) throw new NotFoundError("env.path.not-set", { variable: input.variable });

    const separator = listSeparator(os);
    const firstSeen = new Map<string, number>();
    const entries: PathEntry[] = [];
    for (const [position, entry] of value.split(separator).entries()) {
      const index = position + 1;
      const folder = entryFolder(entry, os, (name) => this.environment.variable(name));
      entries.push({ index, entry, folder, ...(await this.check(folder, index, firstSeen)) });
    }
    const problems = entries.filter((entry) => entry.status !== "ok").length;
    const warnings = problems > 0 ? [message("env.path.problems", { count: problems, total: entries.length })] : [];
    return done({ variable, separator, entries }, { warnings });
  }

  /** Windows spells PATH as Path; show the name the OS uses. */
  private nameOnThisOs(name: string): string {
    if (this.environment.os !== "windows") return name;
    const wanted = name.toLowerCase();
    return Object.keys(this.environment.variables()).find((key) => key.toLowerCase() === wanted) ?? name;
  }

  private async check(
    folder: string,
    index: number,
    firstSeen: Map<string, number>,
  ): Promise<Pick<PathEntry, "status" | "duplicateOf">> {
    const os = this.environment.os;
    if (folder === "") return { status: "empty", duplicateOf: null };
    // A relative entry is searched from whatever folder a program runs in.
    if (!isAbsoluteFolder(folder, os)) return { status: "relative", duplicateOf: null };
    const key = comparableFolder(folder, os);
    const first = firstSeen.get(key);
    if (first !== undefined) return { status: "duplicate", duplicateOf: first };
    firstSeen.set(key, index);
    const stat = await this.fileSystem.stat(folder);
    if (stat === null) return { status: "missing", duplicateOf: null };
    return { status: stat.kind === "directory" ? "ok" : "not-a-folder", duplicateOf: null };
  }
}

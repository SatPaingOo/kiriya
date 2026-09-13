import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import type { CommandContext, CommandResult } from "../../src/core/domain/command.js";
import { message, type Message } from "../../src/core/domain/message.js";
import type { Clock } from "../../src/core/domain/ports/clock.js";
import type { ConfigStore, ConfigValues } from "../../src/core/domain/ports/config-store.js";
import type { Confirmation } from "../../src/core/domain/ports/confirmation.js";
import type { Environment, OsFamily } from "../../src/core/domain/ports/environment.js";
import type { FileSystem } from "../../src/core/domain/ports/file-system.js";
import type { OutputStream, Passthrough } from "../../src/core/domain/ports/passthrough.js";
import type { Listener, PortTable } from "../../src/core/domain/ports/port-table.js";
import type { ProcessOptions, ProcessResult, ProcessRunner } from "../../src/core/domain/ports/process-runner.js";
import type {
  EndOutcome,
  EndResult,
  ProcessInfo,
  ProcessListing,
  ProcessTable,
} from "../../src/core/domain/ports/process-table.js";
import type { RandomSource } from "../../src/core/domain/ports/random-source.js";
import type { StandardInput } from "../../src/core/domain/ports/standard-input.js";
import type { Trash, TrashOutcome } from "../../src/core/domain/ports/trash.js";
import type { MessageKey } from "../../src/i18n/locales/en.js";

export class FakeEnvironment implements Environment {
  constructor(
    readonly os: OsFamily,
    readonly homeDirectory: string,
    private readonly values: Readonly<Record<string, string>> = {},
  ) {}

  variable(name: string): string | undefined {
    return this.values[name];
  }

  variables(): Readonly<Record<string, string>> {
    return this.values;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly epochMs: number) {}

  now(): number {
    return this.epochMs;
  }
}

/** Counts up from a seed byte, wrapping at 256, so generated values are known in advance. */
export class CountingRandomSource implements RandomSource {
  private next: number;

  constructor(seed = 0) {
    this.next = seed;
  }

  bytes(count: number): Uint8Array {
    const bytes = new Uint8Array(count);
    for (let index = 0; index < count; index += 1) {
      bytes[index] = this.next;
      this.next = (this.next + 1) % 256;
    }
    return bytes;
  }
}

/** Piped text, or a terminal when there is none. */
export class FakeStandardInput implements StandardInput {
  readonly isTerminal: boolean;
  private readonly content: Uint8Array;

  constructor(text: string | null) {
    this.isTerminal = text === null;
    this.content = new TextEncoder().encode(text ?? "");
  }

  read(maxBytes: number): Promise<Uint8Array> {
    if (this.content.length > maxBytes) return Promise.reject(new Error("larger than maxBytes"));
    return Promise.resolve(this.content);
  }
}

/** Gives the same answer to every question and records what was asked. */
export class ScriptedConfirmation implements Confirmation {
  readonly asked: Message[] = [];

  constructor(private readonly answer: boolean) {}

  async approve(question: Message, assumeYes: boolean): Promise<boolean> {
    this.asked.push(question);
    return assumeYes || this.answer;
  }

  async typed(warning: Message, expected: string, provided: string | undefined): Promise<boolean> {
    this.asked.push(warning);
    return provided === undefined ? this.answer : provided === expected;
  }
}

/** Removes what it receives, except the paths it is told to refuse. */
export class FakeTrash implements Trash {
  readonly location: MessageKey = "core.trash.location.freedesktop";
  readonly received: string[] = [];

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly refuse: ReadonlySet<string> = new Set(),
  ) {}

  async send(paths: readonly string[]): Promise<readonly TrashOutcome[]> {
    const outcomes: TrashOutcome[] = [];
    for (const target of paths) {
      this.received.push(target);
      if (this.refuse.has(target)) {
        outcomes.push({ path: target, ok: false, reason: message("core.trash.windows.network") });
      } else {
        await this.fileSystem.remove(target);
        outcomes.push({ path: target, ok: true });
      }
    }
    return outcomes;
  }
}

export class RecordingPassthrough implements Passthrough {
  readonly written: Array<{ readonly text: string; readonly stream: OutputStream }> = [];

  write(text: string, stream: OutputStream): void {
    this.written.push({ text, stream });
  }
}

export interface ScriptedRun {
  readonly code?: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface RecordedRun {
  readonly program: string;
  readonly args: readonly string[];
  readonly options: ProcessOptions;
}

/** Knows only the programs it is given, records every run, and answers each from a script. */
export class FakeProcessRunner implements ProcessRunner {
  readonly runs: RecordedRun[] = [];

  constructor(
    private readonly programs: Readonly<Record<string, string>>,
    private readonly answer: (args: readonly string[]) => ScriptedRun = () => ({}),
  ) {}

  find(program: string): Promise<string | null> {
    return Promise.resolve(this.programs[program] ?? null);
  }

  run(program: string, args: readonly string[], options: ProcessOptions = {}): Promise<ProcessResult> {
    this.runs.push({ program, args, options });
    const scripted = this.answer(args);
    const code = scripted.code ?? 0;
    const stdout = scripted.stdout ?? "";
    const stderr = scripted.stderr ?? "";
    if (options.onOutput === undefined) return Promise.resolve({ code, stdout, stderr });
    if (stdout !== "") options.onOutput(stdout, "stdout");
    if (stderr !== "") options.onOutput(stderr, "stderr");
    return Promise.resolve({ code, stdout: "", stderr: "" });
  }
}

/** A configuration file held in memory; null values mean the file does not exist. */
export class MemoryConfigStore implements ConfigStore {
  constructor(
    readonly path = "/home/dev/.config/kiriya/config.json",
    private values: ConfigValues | null = null,
  ) {}

  exists(): Promise<boolean> {
    return Promise.resolve(this.values !== null);
  }

  read(): Promise<ConfigValues> {
    return Promise.resolve(this.values ?? {});
  }

  write(values: ConfigValues): Promise<void> {
    this.values = values;
    return Promise.resolve();
  }

  get current(): ConfigValues | null {
    return this.values;
  }
}

export function commandContext(
  cwd: string,
  confirmation: Confirmation = new ScriptedConfirmation(true),
  passthrough: Passthrough = new RecordingPassthrough(),
): CommandContext {
  return { cwd, confirmation, passthrough, signal: new AbortController().signal };
}

export function expectDone<Output>(result: CommandResult<Output>): Extract<CommandResult<Output>, { kind: "done" }> {
  assert.equal(result.kind, "done");
  return result as Extract<CommandResult<Output>, { kind: "done" }>;
}

/** A fresh folder, removed when the test ends. */
export async function temporaryFolder(t: TestContext): Promise<string> {
  const folder = await mkdtemp(path.join(tmpdir(), "kiriya-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

/** Creates files with the given content, and folders for keys ending in `/`. */
export async function layout(root: string, entries: Readonly<Record<string, string>>): Promise<void> {
  for (const [relative, content] of Object.entries(entries)) {
    const target = path.join(root, ...relative.split("/"));
    if (relative.endsWith("/")) {
      await mkdir(target, { recursive: true });
    } else {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
}

/** Paths relative to root with `/`, for OS-independent assertions. */
export function relativeTo(root: string, paths: readonly string[]): string[] {
  return paths.map((item) => path.relative(root, item).split(path.sep).join("/"));
}

export function processInfo(
  pid: number,
  name: string,
  details: Partial<Omit<ProcessInfo, "pid" | "name">> = {},
): ProcessInfo {
  return { pid, name, ppid: null, command: null, memoryBytes: null, ...details };
}

/** A fixed process list that records what it was asked to list and end, and answers every end with one outcome. */
export class FakeProcessTable implements ProcessTable {
  readonly selfPid: number;
  readonly listed: boolean[] = [];
  readonly ended: Array<{ readonly pids: readonly number[]; readonly force: boolean }> = [];
  private readonly guarded: ReadonlySet<number>;
  private readonly outcome: EndOutcome;

  constructor(
    private readonly processes: readonly ProcessInfo[],
    options: {
      readonly selfPid?: number;
      readonly protectedPids?: readonly number[];
      readonly outcome?: EndOutcome;
    } = {},
  ) {
    this.selfPid = options.selfPid ?? 999_999;
    this.guarded = new Set(options.protectedPids ?? []);
    this.outcome = options.outcome ?? "ended";
  }

  list(detailed: boolean): Promise<ProcessListing> {
    this.listed.push(detailed);
    return Promise.resolve({ processes: this.processes, detailed });
  }

  end(pids: readonly number[], force: boolean): Promise<readonly EndResult[]> {
    this.ended.push({ pids, force });
    return Promise.resolve(pids.map((pid) => ({ pid, outcome: this.outcome, code: null })));
  }

  protectedPids(): ReadonlySet<number> {
    return this.guarded;
  }
}

/** Fixed listeners; a port in the closed set cannot be opened, and every port tried is recorded. */
export class FakePortTable implements PortTable {
  readonly tried: number[] = [];

  constructor(
    private readonly current: readonly Listener[],
    private readonly closed: ReadonlySet<number> = new Set(),
  ) {}

  listeners(): Promise<readonly Listener[]> {
    return Promise.resolve(this.current);
  }

  canListen(port: number): Promise<boolean> {
    this.tried.push(port);
    return Promise.resolve(!this.closed.has(port));
  }
}

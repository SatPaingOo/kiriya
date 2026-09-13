import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import type { CommandContext, CommandResult } from "../../src/core/domain/command.js";
import { message, type Message } from "../../src/core/domain/message.js";
import type { Clock } from "../../src/core/domain/ports/clock.js";
import type { Confirmation } from "../../src/core/domain/ports/confirmation.js";
import type { Environment, OsFamily } from "../../src/core/domain/ports/environment.js";
import type { FileSystem } from "../../src/core/domain/ports/file-system.js";
import type { Trash, TrashOutcome } from "../../src/core/domain/ports/trash.js";
import type { MessageKey } from "../../src/i18n/locales/en.js";

export class FakeEnvironment implements Environment {
  constructor(
    readonly os: OsFamily,
    readonly homeDirectory: string,
    private readonly variables: Readonly<Record<string, string>> = {},
  ) {}

  variable(name: string): string | undefined {
    return this.variables[name];
  }
}

export class FixedClock implements Clock {
  constructor(private readonly epochMs: number) {}

  now(): number {
    return this.epochMs;
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

export function commandContext(
  cwd: string,
  confirmation: Confirmation = new ScriptedConfirmation(true),
): CommandContext {
  return { cwd, confirmation, signal: new AbortController().signal };
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

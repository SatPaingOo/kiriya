import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_MODULES } from "../../../src/config/modules.js";
import { CommandRegistry } from "../../../src/core/application/command-registry.js";
import { done, type Command } from "../../../src/core/domain/command.js";
import { message } from "../../../src/core/domain/message.js";
import type { CorePorts } from "../../../src/core/domain/module.js";
import { parseCommandArguments, splitGlobalFlags } from "../../../src/core/presentation/cli/argv.js";
import { commandHelp, moduleHelp, type HelpContext } from "../../../src/core/presentation/cli/help.js";
import type { Style } from "../../../src/core/presentation/cli/style.js";
import { Translator } from "../../../src/core/presentation/i18n/translator.js";
import { en } from "../../../src/i18n/locales/en.js";

const ports = {} as CorePorts;
const translator = new Translator(en);
const plain = (text: string): string => text;
const style: Style = { bold: plain, dim: plain, red: plain, green: plain, yellow: plain, cyan: plain };
const context: HelpContext = { translator, style, version: "1.0.0" };

function builtIns(): CommandRegistry {
  const registry = new CommandRegistry();
  for (const module of BUILT_IN_MODULES) registry.register(module, ports);
  return registry;
}

/** Shell words up to a pipe or a redirection, with their quotes taken off. */
function wordsOf(line: string): string[] {
  const words: string[] = [];
  for (const match of line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    if (match[3] === "|" || match[3] === "<" || match[3] === ">") break;
    words.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return words;
}

test("module help: the summary, its paragraph wrapped at 80 columns, commands, examples, guide, then the hint", () => {
  const port = builtIns().module("port");
  assert.ok(port);
  const lines = moduleHelp(port, context);
  const commandsAt = lines.indexOf("Commands");
  const paragraph = lines.slice(2, commandsAt - 1);
  assert.match(lines[0] ?? "", /^kiriya port — /);
  assert.equal(lines[1], "");
  assert.equal(paragraph.join(" "), translator.text(message("port.about")));
  assert.ok(paragraph.length > 1 && paragraph.every((line) => line.length <= 80), paragraph.join("\n"));
  assert.deepEqual(lines.slice(lines.indexOf("Examples")), [
    "Examples",
    "  kiriya port who 3000",
    "  kiriya port kill 3000",
    "  kiriya port free --from 8000",
    "",
    "Guide: https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/port.md",
    "Run kiriya help port <command> for a command's arguments and options.",
  ]);
});

test("module help lists each command's option names under it, and nothing for a command with none", () => {
  const port = builtIns().module("port");
  assert.ok(port);
  const lines = moduleHelp(port, context);
  const commands = lines.slice(lines.indexOf("Commands") + 1, lines.indexOf("Examples") - 1);

  // `free` takes options, so they follow its summary on their own line, indented to the description.
  const freeAt = commands.findIndex((line) => /^ {2}free\b/.test(line));
  assert.ok(freeAt >= 0, commands.join("\n"));
  const names = (commands[freeAt + 1] ?? "").trim().split(" ");
  assert.ok(names.length > 0 && names.every((name) => name.startsWith("--")), commands[freeAt + 1]);
  assert.equal(commands[freeAt + 1]?.startsWith("  "), true);

  // Only long forms belong here: a short form or a value would make the line hard to scan.
  assert.ok(!commands.some((line) => /^\s+-{1}[a-z],/.test(line)), "no short forms");
  assert.ok(!commands.some((line) => /^\s+--\S+ </.test(line)), "no option values");

  // Every line is either a command row, a wrapped description, or a row of option names.
  for (const line of commands) assert.ok(line === "" || line.startsWith("  "), line);
});

test("a module without a paragraph, examples or guide, as a plugin may be, shows only its commands", () => {
  const run: Command<undefined, undefined> = {
    spec: {
      id: "demo.run",
      summary: "open.summary",
      input: { positionals: [], options: {}, parse: () => undefined },
      examples: [],
      safety: "read",
      idempotent: true,
      usesNetwork: false,
      runsUserCommands: false,
    },
    execute: () => Promise.resolve(done(undefined)),
  };
  const registry = new CommandRegistry();
  registry.register(
    { id: "demo", summary: "files.summary", register: (registrar) => registrar.add(run, () => []) },
    ports,
  );
  const demo = registry.module("demo");
  assert.ok(demo);
  assert.deepEqual(moduleHelp(demo, context), [
    `kiriya demo — ${translator.text(message("files.summary"))}`,
    "",
    "Commands",
    `  run  ${translator.text(message("open.summary"))}`,
    "",
    "Run kiriya help demo <command> for a command's arguments and options.",
  ]);
});

test("a module that is one command explains the module in its command's help, and other commands do not", () => {
  const registry = builtIns();
  const doctor = registry.module("doctor");
  const git = registry.module("git");
  const own = doctor?.commands.get("");
  const status = git?.commands.get("status");
  assert.ok(doctor && git && own && status);
  const flat = (lines: readonly string[]): string => lines.join(" ").replace(/\s+/g, " ");

  const doctorHelp = commandHelp(doctor, own, context);
  assert.ok(flat(doctorHelp).includes(translator.text(message("doctor.about"))));
  assert.equal(doctorHelp.at(-1), "Guide: https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/doctor.md");

  const statusHelp = flat(commandHelp(git, status, context));
  assert.equal(statusHelp.includes(translator.text(message("git.about"))), false);
  assert.equal(statusHelp.includes("Guide:"), false);
});

test("every example help shows is a command line kiriya accepts", () => {
  const registry = builtIns();
  const rejected: string[] = [];
  for (const module of registry.list()) {
    const commandExamples = [...module.commands.values()].flatMap((entry) => entry.command.spec.examples);
    for (const line of [...module.examples, ...commandExamples]) {
      const words = wordsOf(line);
      // Lines such as eval "$(kiriya completion bash)", or with a placeholder such as <expected-sha256>.
      if (words[0] !== "kiriya" || words.some((word) => /^<.+>$/.test(word))) continue;
      const [moduleId, verb, ...rest] = splitGlobalFlags(words.slice(1)).rest;
      const named = verb === undefined ? undefined : registry.module(moduleId ?? "")?.commands.get(verb);
      const entry = named ?? registry.module(moduleId ?? "")?.commands.get("");
      const args = named !== undefined || verb === undefined ? rest : [verb, ...rest];
      try {
        if (moduleId !== module.id || entry === undefined) throw new Error(`not a command of ${module.id}`);
        entry.command.spec.input.parse(parseCommandArguments(entry.command.spec.input, args));
      } catch (error) {
        rejected.push(`${line}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  assert.deepEqual(rejected, []);
});

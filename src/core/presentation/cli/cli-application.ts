import type { CommandRegistry } from "../../application/command-registry.js";
import type { CommandResult } from "../../domain/command.js";
import { InterruptedError, KiriyaError, UsageError, type ErrorKind } from "../../domain/errors.js";
import { message } from "../../domain/message.js";
import type { Environment } from "../../domain/ports/environment.js";
import type { Catalog } from "../../../i18n/locales/en.js";
import { Translator } from "../i18n/translator.js";
import { parseCommandArguments, splitGlobalFlags, type GlobalFlags } from "./argv.js";
import { CliViewFormat } from "./cli-view-format.js";
import { commandHelp, mainHelp, moduleHelp, type HelpContext } from "./help.js";
import { errorJson, resultJson } from "./json-output.js";
import { createStyle, type Style } from "./style.js";
import { closest } from "./suggest.js";
import { TerminalConfirmation } from "./terminal-confirmation.js";

export interface CliDependencies {
  readonly registry: CommandRegistry;
  readonly catalog: Catalog;
  readonly version: string;
  readonly environment: Environment;
  readonly stdin: NodeJS.ReadStream;
  readonly stdout: NodeJS.WriteStream;
  readonly stderr: NodeJS.WriteStream;
}

const EXIT_CODES: Readonly<Record<ErrorKind, number>> = {
  usage: 2,
  "not-found": 1,
  conflict: 1,
  refused: 1,
  "capability-unavailable": 1,
  failed: 1,
  interrupted: 130,
};

/** The command line: finds the command, runs it, prints its result, and maps errors to exit codes once. */
export class CliApplication {
  private readonly translator: Translator;

  constructor(private readonly deps: CliDependencies) {
    this.translator = new Translator(deps.catalog);
  }

  async run(argv: readonly string[], cwd: string): Promise<number> {
    const { flags, rest } = splitGlobalFlags(argv);
    const colour =
      !flags.noColor &&
      !this.deps.environment.variable("KIRIYA_NO_COLOR") &&
      this.deps.environment.variable("TERM") !== "dumb";
    const out = createStyle(colour, this.deps.stdout);
    const err = createStyle(colour, this.deps.stderr);
    const help: HelpContext = { translator: this.translator, style: out, version: this.deps.version };

    try {
      if (flags.version) return this.print(this.deps.stdout, [this.deps.version]);
      const [first, second, ...args] = rest;
      if (first === undefined) return this.print(this.deps.stdout, mainHelp(this.deps.registry.list(), help));
      if (first === "help") return this.help(second, args[0], help);

      const module = this.findModule(first);
      if (second === undefined) return this.print(this.deps.stdout, moduleHelp(module, help));
      const entry = module.commands.get(second);
      if (entry === undefined) {
        throw this.unknown("core.usage.unknown-command", { module: module.id, name: second }, second, [
          ...module.commands.keys(),
        ]);
      }
      if (flags.help) return this.print(this.deps.stdout, commandHelp(module, entry, help));

      const { spec } = entry.command;
      const input = spec.input.parse(parseCommandArguments(spec.input, args));
      const controller = new AbortController();
      const interrupt = (): void => controller.abort();
      process.once("SIGINT", interrupt);
      let result: CommandResult<unknown>;
      try {
        result = await entry.command.execute(input, {
          cwd,
          signal: controller.signal,
          confirmation: new TerminalConfirmation({
            input: this.deps.stdin,
            output: this.deps.stderr,
            interactive: this.deps.stdin.isTTY === true && !flags.noInput,
            translator: this.translator,
            style: err,
          }),
        });
      } finally {
        process.removeListener("SIGINT", interrupt);
      }
      // The first Ctrl+C asks the command to stop; a second one ends the process as usual.
      if (controller.signal.aborted) throw new InterruptedError("core.error.interrupted");
      return this.report(spec.id, result, flags, cwd, out, err, entry.view);
    } catch (error) {
      return this.fail(error, flags, err);
    }
  }

  private help(moduleName: string | undefined, verb: string | undefined, context: HelpContext): number {
    if (moduleName === undefined) return this.print(this.deps.stdout, mainHelp(this.deps.registry.list(), context));
    const module = this.findModule(moduleName);
    if (verb === undefined) return this.print(this.deps.stdout, moduleHelp(module, context));
    const entry = module.commands.get(verb);
    if (entry === undefined) {
      throw this.unknown("core.usage.unknown-command", { module: module.id, name: verb }, verb, [
        ...module.commands.keys(),
      ]);
    }
    return this.print(this.deps.stdout, commandHelp(module, entry, context));
  }

  private findModule(name: string): NonNullable<ReturnType<CommandRegistry["module"]>> {
    const module = this.deps.registry.module(name);
    if (module !== undefined) return module;
    throw this.unknown(
      "core.usage.unknown-module",
      { name },
      name,
      this.deps.registry.list().map((item) => item.id),
    );
  }

  private unknown(
    key: "core.usage.unknown-module" | "core.usage.unknown-command",
    params: Record<string, string>,
    input: string,
    candidates: readonly string[],
  ): UsageError {
    const suggestion = closest(input, candidates);
    return new UsageError(
      key,
      suggestion === undefined ? params : { ...params, hint: message("core.usage.did-you-mean", { suggestion }) },
    );
  }

  private report(
    commandId: string,
    result: CommandResult<unknown>,
    flags: GlobalFlags,
    cwd: string,
    out: Style,
    err: Style,
    view: (output: unknown, format: CliViewFormat) => readonly string[],
  ): number {
    const failures = result.kind === "done" ? result.failures : [];
    if (flags.json) {
      this.print(this.deps.stdout, [resultJson(commandId, result, this.translator)]);
    } else {
      this.print(this.deps.stdout, view(result.data, new CliViewFormat(this.translator, out, cwd)));
      for (const warning of result.warnings) this.print(this.deps.stderr, [err.yellow(this.translator.text(warning))]);
      for (const failure of failures) this.print(this.deps.stderr, [err.red(this.translator.text(failure))]);
      if (result.kind === "preview") {
        const note =
          result.applyFlag === ""
            ? message("core.result.dry-run")
            : message("core.result.preview", { flag: result.applyFlag });
        this.print(this.deps.stderr, [err.dim(this.translator.text(note))]);
      }
    }
    return failures.length > 0 ? 1 : 0;
  }

  private fail(error: unknown, flags: GlobalFlags, err: Style): number {
    if (flags.json) this.print(this.deps.stdout, [errorJson(error, this.translator)]);
    if (error instanceof KiriyaError) {
      if (!flags.json) {
        const hint = error.detail.params["hint"];
        const lines = [
          `${err.red(this.translator.text(message("core.error.label")))}: ${this.translator.text(error.detail)}`,
        ];
        if (hint !== undefined && typeof hint === "object") lines.push(this.translator.text(hint));
        this.print(this.deps.stderr, lines);
      }
      if (flags.debug && error.cause !== undefined)
        this.print(this.deps.stderr, [String((error.cause as Error).stack ?? error.cause)]);
      return EXIT_CODES[error.kind];
    }
    if (!flags.json) {
      const detail = error instanceof Error ? error.message : String(error);
      this.print(this.deps.stderr, [err.red(this.translator.text(message("core.error.unexpected", { detail })))]);
      if (flags.debug && error instanceof Error && error.stack !== undefined)
        this.print(this.deps.stderr, [error.stack]);
    }
    return 1;
  }

  private print(stream: NodeJS.WritableStream, lines: readonly string[]): number {
    if (lines.length > 0) stream.write(`${lines.join("\n")}\n`);
    return 0;
  }
}

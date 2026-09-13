import type { RegisteredCommand, RegisteredModule } from "../../application/command-registry.js";
import type { OptionSpec } from "../../domain/input-schema.js";
import { message } from "../../domain/message.js";
import type { Translator } from "../i18n/translator.js";
import type { Style } from "./style.js";

export interface HelpContext {
  readonly translator: Translator;
  readonly style: Style;
  readonly version: string;
}

const GLOBAL_OPTIONS = [
  ["--json", "core.option.json"],
  ["--no-color", "core.option.no-color"],
  ["--no-input", "core.option.no-input"],
  ["--debug", "core.option.debug"],
  ["-h, --help", "core.option.help"],
  ["-V, --version", "core.option.version"],
] as const;

function table(rows: ReadonlyArray<readonly [string, string]>): string[] {
  const width = Math.max(0, ...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`);
}

function optionLabel(name: string, spec: OptionSpec): string {
  const value = spec.type === "string" ? ` ${spec.valueName ?? "<value>"}` : "";
  const short = spec.short === undefined ? "" : `-${spec.short}, `;
  return `${short}--${name}${value}`;
}

/** `kiriya files list`, or `kiriya doctor` for a module that is one command. */
function commandName(module: RegisteredModule, entry: RegisteredCommand): string {
  return ["kiriya", module.id, entry.verb].filter((part) => part !== "").join(" ");
}

export function mainHelp(modules: readonly RegisteredModule[], context: HelpContext): string[] {
  const { translator, style } = context;
  return [
    `${style.bold("kiriya")} ${context.version}`,
    translator.text(message("core.app.summary")),
    "",
    style.bold(translator.text(message("core.help.usage"))),
    "  kiriya <module> <command> [arguments] [options]",
    "",
    style.bold(translator.text(message("core.help.modules"))),
    ...table(modules.map((module) => [module.id, translator.text(message(module.summary))])),
    "",
    style.bold(translator.text(message("core.help.global-options"))),
    ...table(GLOBAL_OPTIONS.map(([flag, key]) => [flag, translator.text(message(key))])),
    "",
    translator.text(message("core.help.module-hint", { command: "kiriya help <module>" })),
  ];
}

export function moduleHelp(module: RegisteredModule, context: HelpContext): string[] {
  const { translator, style } = context;
  const commands = [...module.commands.values()]
    .filter((entry) => entry.verb !== "")
    .sort((a, b) => (a.verb < b.verb ? -1 : a.verb > b.verb ? 1 : 0));
  return [
    `${style.bold(`kiriya ${module.id}`)} — ${translator.text(message(module.summary))}`,
    "",
    style.bold(translator.text(message("core.help.commands"))),
    ...table(commands.map((entry) => [entry.verb, translator.text(message(entry.command.spec.summary))])),
    "",
    translator.text(message("core.help.command-hint", { command: `kiriya help ${module.id} <command>` })),
  ];
}

export function commandHelp(module: RegisteredModule, entry: RegisteredCommand, context: HelpContext): string[] {
  const { translator, style } = context;
  const { spec } = entry.command;
  const name = commandName(module, entry);
  const positionals = spec.input.positionals.map((positional) => {
    const label = positional.variadic ? `${positional.name}...` : positional.name;
    return positional.required ? `<${label}>` : `[${label}]`;
  });
  const hasOptions = Object.keys(spec.input.options).length > 0;
  const lines = [
    `${style.bold(name)} — ${translator.text(message(spec.summary))}`,
    "",
    style.bold(translator.text(message("core.help.usage"))),
    `  ${[name, ...positionals, ...(hasOptions ? ["[options]"] : [])].join(" ")}`,
  ];
  if (spec.input.positionals.length > 0) {
    lines.push("", style.bold(translator.text(message("core.help.arguments"))));
    lines.push(
      ...table(
        spec.input.positionals.map((positional) => [positional.name, translator.text(message(positional.description))]),
      ),
    );
  }
  if (hasOptions) {
    lines.push("", style.bold(translator.text(message("core.help.options"))));
    lines.push(
      ...table(
        Object.entries(spec.input.options).map(([option, value]) => [
          optionLabel(option, value),
          translator.text(message(value.description)),
        ]),
      ),
    );
  }
  if (spec.examples.length > 0) {
    lines.push("", style.bold(translator.text(message("core.help.examples"))));
    lines.push(...spec.examples.map((example) => `  ${example}`));
  }
  return lines;
}

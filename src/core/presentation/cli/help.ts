import type { RegisteredCommand, RegisteredModule } from "../../application/command-registry.js";
import { GLOBAL_OPTIONS, type GlobalOption } from "../../domain/global-options.js";
import type { InputSchema, OptionSpec } from "../../domain/input-schema.js";
import { message } from "../../domain/message.js";
import type { Translator } from "../i18n/translator.js";
import type { Style } from "./style.js";

export interface HelpContext {
  readonly translator: Translator;
  readonly style: Style;
  readonly version: string;
}

/** The list of modules and their guides, for main help to point to. */
const GUIDES = "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/README.md";

/** Paragraphs break before this width, so they read the same in any terminal at least this wide. */
const PARAGRAPH_WIDTH = 80;

function globalLabel(option: GlobalOption): string {
  return option.short === null ? `--${option.name}` : `-${option.short}, --${option.name}`;
}

function table(rows: ReadonlyArray<readonly [string, string]>): string[] {
  const width = Math.max(0, ...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`);
}

/** Text broken between words into lines of at most PARAGRAPH_WIDTH characters, unless one word is longer. */
function paragraph(text: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (word === "") continue;
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length > PARAGRAPH_WIDTH) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  return line === "" ? lines : [...lines, line];
}

/** `-i, --ignore-case` or `--to <file>`, as help and the generated docs show an option. */
export function optionLabel(name: string, spec: OptionSpec): string {
  const value = spec.type === "string" ? ` ${spec.valueName ?? "<value>"}` : "";
  const short = spec.short === undefined ? "" : `-${spec.short}, `;
  return `${short}--${name}${value}`;
}

/** `kiriya files list`, or `kiriya doctor` for a module that is one command. */
function commandName(module: RegisteredModule, entry: RegisteredCommand): string {
  return ["kiriya", module.id, entry.verb].filter((part) => part !== "").join(" ");
}

/** How a command is typed, such as `kiriya files delete <paths...> [options]`. */
export function usageLine(module: RegisteredModule, entry: RegisteredCommand): string {
  const { input } = entry.command.spec;
  const positionals = input.positionals.map((positional) => {
    const label = positional.variadic ? `${positional.name}...` : positional.name;
    return positional.required ? `<${label}>` : `[${label}]`;
  });
  const options = Object.keys(input.options).length > 0 ? ["[options]"] : [];
  return [commandName(module, entry), ...positionals, ...options].join(" ");
}

function aboutLines(module: RegisteredModule, context: HelpContext): string[] {
  return module.about === null ? [] : ["", ...paragraph(context.translator.text(message(module.about)))];
}

function exampleLines(examples: readonly string[], context: HelpContext): string[] {
  if (examples.length === 0) return [];
  const heading = context.style.bold(context.translator.text(message("core.help.examples")));
  return ["", heading, ...examples.map((example) => `  ${example}`)];
}

function guideLines(module: RegisteredModule, context: HelpContext): string[] {
  return module.guide === null ? [] : [context.translator.text(message("core.help.guide", { address: module.guide }))];
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
    ...table(
      GLOBAL_OPTIONS.map((option) => [globalLabel(option), translator.text(message(option.description))] as const),
    ),
    "",
    translator.text(message("core.help.module-hint", { command: "kiriya help <module>" })),
    translator.text(message("core.help.mcp-hint", { command: "kiriya mcp --help" })),
    translator.text(message("core.help.guides", { address: GUIDES })),
  ];
}

/** `kiriya mcp`, which serves the commands to AI agents instead of being one of them. */
export function mcpHelp(input: InputSchema<unknown>, context: HelpContext): string[] {
  const { translator, style } = context;
  return [
    `${style.bold("kiriya mcp")} — ${translator.text(message("core.mcp.summary"))}`,
    "",
    style.bold(translator.text(message("core.help.usage"))),
    "  kiriya mcp [folders...] [--root <folder>]...",
    "",
    style.bold(translator.text(message("core.help.arguments"))),
    ...table(
      input.positionals.map((positional) => [positional.name, translator.text(message(positional.description))]),
    ),
    "",
    style.bold(translator.text(message("core.help.options"))),
    ...table(
      Object.entries(input.options).map(([name, spec]) => [
        optionLabel(name, spec),
        translator.text(message(spec.description)),
      ]),
    ),
    "",
    translator.text(message("core.mcp.help-details")),
  ];
}

export function moduleHelp(module: RegisteredModule, context: HelpContext): string[] {
  const { translator, style } = context;
  const commands = [...module.commands.values()]
    .filter((entry) => entry.verb !== "")
    .sort((a, b) => (a.verb < b.verb ? -1 : a.verb > b.verb ? 1 : 0));
  return [
    `${style.bold(`kiriya ${module.id}`)} — ${translator.text(message(module.summary))}`,
    ...aboutLines(module, context),
    "",
    style.bold(translator.text(message("core.help.commands"))),
    ...table(commands.map((entry) => [entry.verb, translator.text(message(entry.command.spec.summary))])),
    ...exampleLines(module.examples, context),
    "",
    ...guideLines(module, context),
    translator.text(message("core.help.command-hint", { command: `kiriya help ${module.id} <command>` })),
  ];
}

export function commandHelp(module: RegisteredModule, entry: RegisteredCommand, context: HelpContext): string[] {
  const { translator, style } = context;
  const { spec } = entry.command;
  // A module that is one command has no help of its own, so its command's help also explains the module.
  const own = entry.verb === "";
  const lines = [
    `${style.bold(commandName(module, entry))} — ${translator.text(message(spec.summary))}`,
    ...(own ? aboutLines(module, context) : []),
    "",
    style.bold(translator.text(message("core.help.usage"))),
    `  ${usageLine(module, entry)}`,
  ];
  if (spec.input.positionals.length > 0) {
    lines.push("", style.bold(translator.text(message("core.help.arguments"))));
    lines.push(
      ...table(
        spec.input.positionals.map((positional) => [positional.name, translator.text(message(positional.description))]),
      ),
    );
  }
  if (Object.keys(spec.input.options).length > 0) {
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
  lines.push(...exampleLines(spec.examples, context));
  const guide = own ? guideLines(module, context) : [];
  if (guide.length > 0) lines.push("", ...guide);
  return lines;
}

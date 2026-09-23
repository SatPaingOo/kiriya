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
  /**
   * The terminal's width. When set, help wraps to it; when absent (piped output and the
   * tests), paragraphs wrap at 80 and tables do not wrap, so that output stays stable.
   */
  readonly width?: number;
  /** Show the wordmark. Only a terminal with colour sets this. */
  readonly logo?: boolean;
}

/** The list of modules and their guides, for main help to point to. */
const GUIDES = "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/README.md";

/** Prose reads best in a column this wide, even in a much wider terminal. */
const PARAGRAPH_WIDTH = 80;

/** The width prose wraps to: the terminal when it is narrower than a comfortable column, else 80. */
function proseWidth(context: HelpContext): number {
  return context.width === undefined ? PARAGRAPH_WIDTH : Math.min(context.width, PARAGRAPH_WIDTH);
}

function globalLabel(option: GlobalOption): string {
  return option.short === null ? `--${option.name}` : `-${option.short}, --${option.name}`;
}

/**
 * A `--flag` in cyan and a `<value>` in yellow, so an option and its argument stand out in a
 * usage line. Every other character, brackets and spaces included, is left exactly as it was,
 * so with colour off the string is unchanged and stays safe to measure and to pad.
 */
function colorize(text: string, style: Style): string {
  return text.replace(
    /(--?[A-Za-z][\w-]*)|(<[^>]*>)/g,
    (_match, flag: string | undefined, value: string | undefined) =>
      flag !== undefined ? style.cyan(flag) : style.yellow(value ?? ""),
  );
}

interface TableOptions {
  /** Wrap the right column to this width with a hanging indent. Absent: one line per row. */
  readonly width?: number | undefined;
  /** Colour the left column's name. The padding stays plain, so columns still line up. */
  readonly paint?: ((name: string) => string) | undefined;
  /** A further line under a row, indented to the description, such as a command's option names. */
  readonly note?: ((name: string) => string | undefined) | undefined;
  /** Colour a note. It is applied after wrapping, so escape codes never count towards the width. */
  readonly paintNote?: ((line: string) => string) | undefined;
}

function table(rows: ReadonlyArray<readonly [string, string]>, options: TableOptions = {}): string[] {
  const nameWidth = Math.max(0, ...rows.map(([left]) => left.length));
  const start = 2 + nameWidth + 2;
  const lines: string[] = [];
  for (const [left, right] of rows) {
    const name = options.paint === undefined ? left : options.paint(left);
    const padding = " ".repeat(nameWidth - left.length);
    const wrapped = options.width === undefined ? [right] : wrap(right, Math.max(20, options.width - start));
    lines.push(`  ${name}${padding}  ${wrapped[0] ?? ""}`);
    for (const line of wrapped.slice(1)) lines.push(`${" ".repeat(start)}${line}`);
    const note = options.note?.(left);
    if (note !== undefined && note !== "") {
      const noteLines = options.width === undefined ? [note] : wrap(note, Math.max(20, options.width - start));
      for (const line of noteLines) {
        lines.push(`${" ".repeat(start)}${options.paintNote === undefined ? line : options.paintNote(line)}`);
      }
    }
  }
  return lines;
}

/** Text broken between words into lines of at most `width` characters, unless one word is longer. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (word === "") continue;
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  return line === "" ? lines : [...lines, line];
}

/** A paragraph of prose, always wrapped for readability (the module `about` text). */
function paragraph(text: string, context: HelpContext): string[] {
  return wrap(text, proseWidth(context));
}

/**
 * A line of prose that was one line before: wrapped only to a known terminal width, and left
 * whole for piped output, so a script or a doc reads the summary and each hint on one line.
 */
function flow(text: string, context: HelpContext): string[] {
  return context.width === undefined ? [text] : wrap(text, proseWidth(context));
}

/** A small wordmark for a terminal: the name in a rounded box, then the version. */
function wordmark(context: HelpContext): string[] {
  const { style } = context;
  const inner = "  kiriya  ";
  const bar = "─".repeat(inner.length);
  return [
    style.cyan(`╭${bar}╮`),
    `${style.cyan("│  ")}${style.bold(style.cyan("kiriya"))}${style.cyan("  │")}`,
    style.cyan(`╰${bar}╯`),
    style.dim(`v${context.version}`),
  ];
}

/** `-i, --ignore-case` or `--to <file>`, as help and the generated docs show an option. */
export function optionLabel(name: string, spec: OptionSpec): string {
  const named = spec.valueName ?? (spec.choices === undefined ? "<value>" : `<${spec.choices.join("|")}>`);
  const value = spec.type === "string" ? ` ${named}` : "";
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
  return module.about === null ? [] : ["", ...paragraph(context.translator.text(message(module.about)), context)];
}

function exampleLines(examples: readonly string[], context: HelpContext): string[] {
  if (examples.length === 0) return [];
  const heading = context.style.bold(context.translator.text(message("core.help.examples")));
  return ["", heading, ...examples.map((example) => `  ${colorize(example, context.style)}`)];
}

function guideLines(module: RegisteredModule, context: HelpContext): string[] {
  return module.guide === null
    ? []
    : flow(context.translator.text(message("core.help.guide", { address: module.guide })), context);
}

/** An options table, its labels coloured and its descriptions wrapped to the terminal. */
function optionsTable(options: Readonly<Record<string, OptionSpec>>, context: HelpContext): string[] {
  return table(
    Object.entries(options).map(
      ([name, spec]) => [optionLabel(name, spec), context.translator.text(message(spec.description))] as const,
    ),
    { width: context.width, paint: (label) => colorize(label, context.style) },
  );
}

function argumentsTable(input: InputSchema<unknown>, context: HelpContext): string[] {
  return table(
    input.positionals.map((positional) => [positional.name, context.translator.text(message(positional.description))]),
    { width: context.width, paint: (name) => context.style.yellow(name) },
  );
}

export function mainHelp(modules: readonly RegisteredModule[], context: HelpContext): string[] {
  const { translator, style } = context;
  const heading = context.logo === true ? wordmark(context) : [`${style.bold("kiriya")} ${context.version}`];
  return [
    ...heading,
    ...flow(translator.text(message("core.app.summary")), context),
    "",
    style.bold(translator.text(message("core.help.usage"))),
    `  ${colorize("kiriya <module> <command> [arguments] [options]", style)}`,
    "",
    style.bold(translator.text(message("core.help.modules"))),
    ...table(
      modules.map((module) => [module.id, translator.text(message(module.summary))]),
      { width: context.width, paint: (id) => style.green(id) },
    ),
    "",
    style.bold(translator.text(message("core.help.global-options"))),
    ...table(
      GLOBAL_OPTIONS.map((option) => [globalLabel(option), translator.text(message(option.description))] as const),
      { width: context.width, paint: (label) => colorize(label, style) },
    ),
    "",
    ...flow(translator.text(message("core.help.module-hint", { command: "kiriya help <module>" })), context),
    ...flow(translator.text(message("core.help.mcp-hint", { command: "kiriya mcp --help" })), context),
    ...flow(translator.text(message("core.help.guides", { address: GUIDES })), context),
  ];
}

/** `kiriya mcp`, which serves the commands to AI agents instead of being one of them. */
export function mcpHelp(input: InputSchema<unknown>, context: HelpContext): string[] {
  const { translator, style } = context;
  return [
    `${style.bold("kiriya mcp")} — ${translator.text(message("core.mcp.summary"))}`,
    "",
    style.bold(translator.text(message("core.help.usage"))),
    `  ${colorize("kiriya mcp [folders...] [--root <folder>]...", style)}`,
    "",
    style.bold(translator.text(message("core.help.arguments"))),
    ...argumentsTable(input, context),
    "",
    style.bold(translator.text(message("core.help.options"))),
    ...optionsTable(input.options, context),
    "",
    ...flow(translator.text(message("core.mcp.help-details")), context),
  ];
}

export function moduleHelp(module: RegisteredModule, context: HelpContext): string[] {
  const { translator, style } = context;
  const commands = [...module.commands.values()]
    .filter((entry) => entry.verb !== "")
    .sort((a, b) => (a.verb < b.verb ? -1 : a.verb > b.verb ? 1 : 0));
  // What each command takes, so its options can be seen here rather than one command at a time.
  // Long forms only: the short ones, the values and the descriptions belong in the command's own help.
  const options = new Map(
    commands.map((entry) => {
      const names = Object.keys(entry.command.spec.input.options);
      return [entry.verb, names.length === 0 ? undefined : names.map((name) => `--${name}`).join(" ")];
    }),
  );
  return [
    `${style.bold(`kiriya ${module.id}`)} — ${translator.text(message(module.summary))}`,
    ...aboutLines(module, context),
    "",
    style.bold(translator.text(message("core.help.commands"))),
    ...table(
      commands.map((entry) => [entry.verb, translator.text(message(entry.command.spec.summary))]),
      {
        width: context.width,
        paint: (verb) => style.green(verb),
        note: (verb) => options.get(verb),
        paintNote: (line) => style.dim(line),
      },
    ),
    ...exampleLines(module.examples, context),
    "",
    ...guideLines(module, context),
    ...flow(
      translator.text(message("core.help.command-hint", { command: `kiriya help ${module.id} <command>` })),
      context,
    ),
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
    `  ${colorize(usageLine(module, entry), style)}`,
  ];
  if (spec.input.positionals.length > 0) {
    lines.push("", style.bold(translator.text(message("core.help.arguments"))));
    lines.push(...argumentsTable(spec.input, context));
  }
  if (Object.keys(spec.input.options).length > 0) {
    lines.push("", style.bold(translator.text(message("core.help.options"))));
    lines.push(...optionsTable(spec.input.options, context));
  }
  lines.push(...exampleLines(spec.examples, context));
  const guide = own ? guideLines(module, context) : [];
  if (guide.length > 0) lines.push("", ...guide);
  return lines;
}

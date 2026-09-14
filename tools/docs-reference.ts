/**
 * The parts of kiriya's docs that the command specs can write: each module guide's command
 * reference, the lists of modules, and the tables of global options and settings. They sit
 * between markers in hand-written pages. `npm run docs` fills them in, and CI fails when a
 * page and the CLI disagree or a link in the docs leads nowhere.
 */
import path from "node:path";
import { CONFIG_KEYS } from "../src/config/config-keys.js";
import type { RegisteredCommand, RegisteredModule } from "../src/core/application/command-registry.js";
import type { SafetyLevel } from "../src/core/domain/command.js";
import { GLOBAL_OPTIONS } from "../src/core/domain/global-options.js";
import { message } from "../src/core/domain/message.js";
import { optionLabel, usageLine } from "../src/core/presentation/cli/help.js";
import type { Translator } from "../src/core/presentation/i18n/translator.js";
import { offeredAsTool } from "../src/core/presentation/mcp/mcp-server.js";
import type { MessageKey } from "../src/i18n/locales/en.js";

/** Where the guides of built-in modules are published; each module's `guide` points here. */
export const GUIDE_ADDRESS = "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/";

export const GENERATED_NOTE =
  "<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->";

const SAFETY: Readonly<Record<SafetyLevel, string>> = {
  read: "changes nothing",
  write: "can change things, in ways that can be undone",
  destroy: "can do work that cannot be undone, and asks for a typed confirmation first",
};

const code = (text: string): string => `\`${text}\``;
/** Text for a table cell, where a bare | would end the cell. */
const cell = (text: string): string => text.replace(/\|/g, "\\|");
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

/** A module's own command first, then the others by verb in code-point order. */
function commandsOf(module: RegisteredModule): RegisteredCommand[] {
  return [...module.commands.values()].sort((a, b) => (a.verb < b.verb ? -1 : a.verb > b.verb ? 1 : 0));
}

function mcpNote(entry: RegisteredCommand): string {
  const { spec } = entry.command;
  const offered = (allowWrite: boolean, allowDestroy: boolean): boolean =>
    offeredAsTool(spec, { allowWrite, allowDestroy });
  if (offered(false, false)) return "offered to AI agents by default";
  if (offered(true, false)) return "offered to AI agents when `mcp.allowWrite` is `true`";
  if (offered(false, true)) return "offered to AI agents with elicitation when `mcp.allowDestroy` is `true`";
  if (offered(true, true)) {
    return "offered to AI agents with elicitation when `mcp.allowWrite` and `mcp.allowDestroy` are `true`";
  }
  return spec.runsUserCommands
    ? "never offered to AI agents, because it runs programs the user names"
    : "never offered to AI agents, because it is only for a person at a terminal";
}

function commandSection(module: RegisteredModule, entry: RegisteredCommand, translator: Translator): string[] {
  const { spec } = entry.command;
  const text = (key: MessageKey): string => sentence(translator.text(message(key)));
  const name = entry.verb === "" ? `kiriya ${module.id}` : `kiriya ${module.id} ${entry.verb}`;
  const lines = [`### ${code(name)}`, "", text(spec.summary), "", "```text", usageLine(module, entry), "```"];

  if (spec.input.positionals.length > 0) {
    lines.push("", "| Argument | Description |", "|---|---|");
    for (const positional of spec.input.positionals) {
      const label = positional.variadic ? `${positional.name}...` : positional.name;
      const choices = positional.choices === undefined ? [] : [`One of ${positional.choices.map(code).join(", ")}.`];
      lines.push(`| ${code(label)} | ${cell([text(positional.description), ...choices].join(" "))} |`);
    }
  }

  const options = Object.entries(spec.input.options);
  if (options.length > 0) {
    lines.push("", "| Option | Description |", "|---|---|");
    for (const [option, value] of options) {
      const notes = [
        value.multiple === true ? "Can be given more than once." : "",
        value.terminalOnly === true ? "Only at a terminal." : "",
        value.sensitive === true ? "Can show secrets." : "",
      ].filter((note) => note !== "");
      // A | stays inside the cell only when escaped, even inside code, as in `--type <file|dir>`.
      const label = cell(code(optionLabel(option, value)));
      lines.push(`| ${label} | ${cell([text(value.description), ...notes].join(" "))} |`);
    }
  }

  lines.push(
    "",
    `- **Safety:** ${code(spec.safety)}, ${SAFETY[spec.safety]}`,
    ...(spec.usesNetwork ? ["- **Network:** uses the network"] : []),
    ...(spec.runsUserCommands ? ["- **Programs:** runs programs the user names"] : []),
    `- **MCP:** ${mcpNote(entry)}`,
  );
  if (spec.examples.length > 0) lines.push("", "```bash", ...spec.examples, "```");
  return lines;
}

/** The `## Reference` part of a module's guide: every command with its arguments, options, safety and examples. */
export function moduleReference(module: RegisteredModule, translator: Translator): string {
  const lines = [GENERATED_NOTE, "", "## Reference"];
  for (const entry of commandsOf(module)) lines.push("", ...commandSection(module, entry, translator));
  return lines.join("\n");
}

/** A table of modules linking to their guides, which sit in `folder`, with their commands when asked. */
export function moduleTable(
  modules: readonly RegisteredModule[],
  translator: Translator,
  options: { readonly folder: string; readonly commands: boolean },
): string {
  const rows = modules.map((module) => {
    const cells = [
      `[${code(module.id)}](${options.folder}${module.id}.md)`,
      cell(sentence(translator.text(message(module.summary)))),
    ];
    if (options.commands) {
      const names = commandsOf(module).map((entry) => code(entry.verb === "" ? `kiriya ${module.id}` : entry.verb));
      cells.push(names.join(" "));
    }
    return `| ${cells.join(" | ")} |`;
  });
  const header = options.commands
    ? ["| Module | What it does | Commands |", "|---|---|---|"]
    : ["| Module | What it does |", "|---|---|"];
  return [GENERATED_NOTE, "", ...header, ...rows].join("\n");
}

export function globalOptionsTable(translator: Translator): string {
  const rows = GLOBAL_OPTIONS.map((option) => {
    const label = option.short === null ? `--${option.name}` : `-${option.short}, --${option.name}`;
    return `| ${code(label)} | ${cell(sentence(translator.text(message(option.description))))} |`;
  });
  return [GENERATED_NOTE, "", "| Option | Description |", "|---|---|", ...rows].join("\n");
}

export function settingsTable(translator: Translator): string {
  const rows = CONFIG_KEYS.map((key) => {
    const takes =
      key.choices !== undefined
        ? key.choices.map(code).join(" or ")
        : key.type === "list"
          ? "a list of values"
          : "one value";
    const description = cell(sentence(translator.text(message(key.description))));
    return `| ${code(key.key)} | ${takes} | ${description} | ${code(`kiriya config set ${key.key} ${key.example}`)} |`;
  });
  return [GENERATED_NOTE, "", "| Setting | Takes | Description | Example |", "|---|---|---|---|", ...rows].join("\n");
}

/**
 * The page with each named block replaced, between `<!-- kiriya:<name> -->` and
 * `<!-- /kiriya:<name> -->`, and the names whose markers it lacks.
 */
export function fillBlocks(
  page: string,
  blocks: Readonly<Record<string, string>>,
): { readonly text: string; readonly missing: readonly string[] } {
  let text = page;
  const missing: string[] = [];
  for (const [name, content] of Object.entries(blocks)) {
    const start = `<!-- kiriya:${name} -->`;
    const end = `<!-- /kiriya:${name} -->`;
    const from = text.indexOf(start);
    const to = from < 0 ? -1 : text.indexOf(end, from + start.length);
    if (to < 0) {
      missing.push(name);
      continue;
    }
    text = `${text.slice(0, from + start.length)}\n${content}\n${text.slice(to)}`;
  }
  return { text, missing };
}

/** What a built-in module lacks for its help and guide. */
export function moduleProblems(module: RegisteredModule): string[] {
  const problems: string[] = [];
  const guide = `${GUIDE_ADDRESS}${module.id}.md`;
  if (module.about === null) problems.push(`${module.id}: no about paragraph for kiriya help ${module.id}`);
  if (module.guide !== guide) problems.push(`${module.id}: its guide should be ${guide}`);
  if (!module.commands.has("") && module.examples.length === 0) problems.push(`${module.id}: no examples`);
  for (const example of module.examples) {
    if (!example.startsWith(`kiriya ${module.id} `))
      problems.push(`${module.id}: the example "${example}" is another module's`);
  }
  return problems;
}

export interface DocPage {
  /** Relative to the repository, with `/`. */
  readonly path: string;
  readonly text: string;
}

/** Lines inside fenced code blocks blanked, so their contents are neither links nor headings. */
function withoutFences(markdown: string): string[] {
  let fenced = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced ? "" : line;
  });
}

/** Heading anchors as GitHub makes them: lower case, punctuation dropped, spaces as hyphens, repeats numbered. */
export function anchorsOf(markdown: string): ReadonlySet<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const line of withoutFences(markdown)) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (heading === null) continue;
    const base = (heading[1] ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

const LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Relative links in a page that lead nowhere: to a file or folder that does not exist, or to an
 * anchor no heading makes. `find` gives the text of a markdown file at a repository path, "" for
 * any other file or folder there, and null when nothing is there.
 */
export function brokenLinks(page: DocPage, find: (repositoryPath: string) => string | null): string[] {
  const problems: string[] = [];
  withoutFences(page.text).forEach((line, index) => {
    for (const match of line.replace(/`[^`]*`/g, "").matchAll(LINK)) {
      const target = match[1] ?? "";
      if (SCHEME.test(target)) continue;
      const where = `${page.path}:${index + 1}`;
      const hash = target.indexOf("#");
      const relative = decodeURIComponent(hash < 0 ? target : target.slice(0, hash));
      const anchor = hash < 0 ? "" : decodeURIComponent(target.slice(hash + 1));
      const joined = relative === "" ? page.path : path.posix.join(path.posix.dirname(page.path), relative);
      const repositoryPath = path.posix.normalize(joined).replace(/\/$/, "");
      if (repositoryPath === ".." || repositoryPath.startsWith("../")) {
        problems.push(`${where}: ${target} leads outside the repository`);
        continue;
      }
      const text = find(repositoryPath);
      if (text === null) problems.push(`${where}: ${target} does not exist`);
      else if (anchor !== "" && !anchorsOf(text).has(anchor)) problems.push(`${where}: ${target} has no such heading`);
    }
  });
  return problems;
}

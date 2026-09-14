/**
 * Writes the generated parts of kiriya's docs from the command specs: `npm run docs`. With
 * `--check`, as CI runs it, it writes nothing and fails when a page is out of date, a built-in
 * module lacks its help or guide, or a relative link in the docs leads nowhere.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUILT_IN_MODULES } from "../src/config/modules.js";
import { CommandRegistry } from "../src/core/application/command-registry.js";
import type { CorePorts } from "../src/core/domain/module.js";
import { Translator } from "../src/core/presentation/i18n/translator.js";
import { en } from "../src/i18n/locales/en.js";
import {
  brokenLinks,
  fillBlocks,
  globalOptionsTable,
  moduleProblems,
  moduleReference,
  moduleTable,
  settingsTable,
} from "./docs-reference.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const checking = process.argv.includes("--check");
const read = (page: string): string => readFileSync(path.join(ROOT, page), "utf8").replace(/\r\n/g, "\n");

// Registering only constructs each command, so no port has to work.
const registry = new CommandRegistry();
for (const module of BUILT_IN_MODULES) registry.register(module, {} as CorePorts);
const translator = new Translator(en);
const modules = registry.list();

const pages: Record<string, Record<string, string>> = {
  "README.md": { modules: moduleTable(modules, translator, { folder: "docs/modules/", commands: false }) },
  "docs/modules/README.md": { modules: moduleTable(modules, translator, { folder: "", commands: true }) },
  "docs/usage.md": { "global-options": globalOptionsTable(translator), settings: settingsTable(translator) },
};
for (const module of modules)
  pages[`docs/modules/${module.id}.md`] = { reference: moduleReference(module, translator) };

const problems = modules.flatMap(moduleProblems);
for (const [page, blocks] of Object.entries(pages)) {
  if (!existsSync(path.join(ROOT, page))) {
    problems.push(`${page}: missing`);
    continue;
  }
  const current = read(page);
  const filled = fillBlocks(current, blocks);
  problems.push(...filled.missing.map((name) => `${page}: no <!-- kiriya:${name} --> block`));
  if (filled.text === current) continue;
  if (checking) {
    problems.push(`${page}: out of date; run npm run docs`);
  } else {
    writeFileSync(path.join(ROOT, page), filled.text);
    console.log(`docs: wrote ${page}`);
  }
}

const markdownIn = (folder: string): string[] =>
  readdirSync(path.join(ROOT, folder), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.posix.join(folder, file.split(path.sep).join("/")));
const docs = [...readdirSync(ROOT).filter((file) => file.endsWith(".md")), ...markdownIn("docs")];
const find = (repositoryPath: string): string | null => {
  const absolute = path.join(ROOT, repositoryPath);
  if (!existsSync(absolute)) return null;
  return repositoryPath.endsWith(".md") && statSync(absolute).isFile() ? read(repositoryPath) : "";
};
for (const page of docs) problems.push(...brokenLinks({ path: page, text: read(page) }, find));

for (const problem of problems) console.error(`docs: ${problem}`);
if (problems.length > 0) {
  console.error(`docs check: ${problems.length} problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`docs: ${modules.length} modules and ${docs.length} pages ${checking ? "match the CLI" : "written"}`);
}

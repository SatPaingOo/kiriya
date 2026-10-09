/**
 * Writes `src/config/output-shapes.ts` from the command output types: `npm run shapes`. With
 * `--check`, as CI runs it, it writes nothing and fails when the committed file is out of date
 * or a command's shape cannot be read.
 *
 * The file is committed, rather than read at startup, because the MCP server needs these
 * shapes while running and the TypeScript compiler is a development dependency it never ships.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { BUILT_IN_MODULES } from "../src/config/modules.js";
import { CommandRegistry } from "../src/core/application/command-registry.js";
import type { CorePorts } from "../src/core/domain/module.js";
import { extractShapes } from "./output-shapes.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TARGET = "src/config/output-shapes.ts";
const checking = process.argv.includes("--check");

// Registering only constructs each command, so no port has to work.
const registry = new CommandRegistry();
for (const module of BUILT_IN_MODULES) registry.register(module, {} as CorePorts);
const commandIds = registry.list().flatMap((module) => [...module.commands.values()].map((e) => e.command.spec.id));

const { records, commands, problems } = extractShapes(ROOT, commandIds);
if (problems.length > 0) {
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`shapes: ${problems.length} problem(s)`);
  process.exit(1);
}

const header = [
  "// Written by `npm run shapes` from each command's output type. Do not edit by hand.",
  "// Its source is the TypeScript type itself, so changing an output changes this file.",
  'import type { OutputShapes } from "../core/domain/output-shape.js";',
  "",
  "export const OUTPUT_SHAPES: OutputShapes = ",
].join("\n");

const options = await prettier.resolveConfig(path.join(ROOT, TARGET));
const written = await prettier.format(`${header}${JSON.stringify({ records, commands }, null, 2)};\n`, {
  ...options,
  parser: "typescript",
});

const where = path.join(ROOT, TARGET);
const current = (() => {
  try {
    return readFileSync(where, "utf8").replace(/\r\n/g, "\n");
  } catch {
    return null;
  }
})();

if (current === written) {
  console.log(`shapes: ${Object.keys(commands).length} commands, ${Object.keys(records).length} records, up to date`);
} else if (checking) {
  console.error(`${TARGET} is out of date. Run npm run shapes.`);
  process.exit(1);
} else {
  writeFileSync(where, written);
  console.log(
    `shapes: ${Object.keys(commands).length} commands, ${Object.keys(records).length} records written to ${TARGET}`,
  );
}

/** Fails when any file under src/ breaks an import rule. Run by `npm test` after the build. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findViolations } from "./boundaries.js";

const SOURCE_ROOT = fileURLToPath(new URL("../../src/", import.meta.url));

const files = readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".ts"))
  .map((file) => ({ path: file.split(path.sep).join("/"), text: readFileSync(path.join(SOURCE_ROOT, file), "utf8") }));

const violations = findViolations(files);
for (const violation of violations) {
  console.error(`src/${violation.file}:${violation.line}  ${violation.specifier}  ${violation.rule}`);
}
if (violations.length > 0) {
  console.error(`Import boundaries: ${violations.length} violation(s)`);
  process.exitCode = 1;
} else {
  console.log(`Import boundaries: ${files.length} files checked, no violations`);
}

/** Fails when `npm pack --dry-run --json` shows a package that ships too much or too little. Run in CI and before a release. */
import { readFileSync } from "node:fs";
import { packageProblems } from "./package-check.js";

const report = process.argv[2];
if (report === undefined) {
  console.error("Usage: node dist/tools/check-package.js <file with the output of npm pack --dry-run --json>");
  process.exitCode = 2;
} else {
  const packs = JSON.parse(readFileSync(report, "utf8")) as ReadonlyArray<{ files?: ReadonlyArray<{ path: string }> }>;
  const files = packs[0]?.files?.map((file) => file.path) ?? [];
  const problems = packageProblems(files);
  for (const problem of problems) console.error(`Package: ${problem}`);
  if (problems.length > 0) {
    console.error(`Package contents: ${problems.length} problem(s)`);
    process.exitCode = 1;
  } else {
    console.log(`Package contents: ${files.length} files, as expected`);
  }
}

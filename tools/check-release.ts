/** Fails when the release being published does not match package.json and CHANGELOG.md. Run by the release workflow. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releaseProblems } from "./release-check.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const manifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
  version: string;
  private?: boolean;
};
const problems = releaseProblems({
  tag: process.env["RELEASE_TAG"],
  version: manifest.version,
  isPrivate: manifest.private === true,
  changelog: readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8"),
});

for (const problem of problems) console.error(`Release: ${problem}`);
if (problems.length > 0) {
  console.error(`Release check: ${problems.length} problem(s); nothing is published`);
  process.exitCode = 1;
} else {
  console.log(`Release check: v${manifest.version} is ready to publish`);
}

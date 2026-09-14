/** Fails when server.json, which the MCP Registry reads, does not match package.json. Run in CI and by the release workflow. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serverProblems, type PackageFacts } from "./server-check.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (file: string): unknown => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));

const manifest = read("package.json") as PackageFacts;
const problems = serverProblems(manifest, read("server.json"));

for (const problem of problems) console.error(`server.json: ${problem}`);
if (problems.length > 0) {
  console.error(`server.json check: ${problems.length} problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`server.json check: ${manifest.mcpName ?? ""} ${manifest.version} matches package.json`);
}

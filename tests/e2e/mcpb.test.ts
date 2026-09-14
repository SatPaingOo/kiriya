import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runKiriya } from "../support/cli.js";
import { temporaryFolder } from "../support/fakes.js";

const BUILD = fileURLToPath(new URL("../../tools/build-mcpb.js", import.meta.url));
const PACKAGE = fileURLToPath(new URL("../../../package.json", import.meta.url));

type Json = { [key: string]: unknown };

/** Every file below a folder, relative, with `/`. */
async function filesIn(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(folder, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));
}

/** Starts a server the way the app does, asks server/discover, then closes stdin and waits for the exit code. */
function discover(args: readonly string[]): Promise<{ result: Json; code: number | null }> {
  return new Promise((resolve, reject) => {
    // Started outside the folders the test removes, which Windows would otherwise refuse to remove.
    const child = spawn(process.execPath, [...args], {
      cwd: tmpdir(),
      env: { ...process.env, KIRIYA_CONFIG: path.join(tmpdir(), "kiriya-tests", "no-config.json") },
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("the bundled server did not answer within 60 s"));
    }, 60_000);
    let buffer = "";
    let result: Json | undefined;
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      buffer += chunk;
      const line = buffer.split("\n").find((candidate) => candidate.includes('"id":1'));
      if (line !== undefined && result === undefined) {
        result = (JSON.parse(line) as { result: Json }).result;
        child.stdin.end();
      }
    });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (result === undefined) reject(new Error(`the bundled server exited with ${String(code)} before answering`));
      else resolve({ result, code });
    });
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      })}\n`,
    );
  });
}

test("the MCP bundle holds the program, and started as the app starts it, serves the folders the user picked", async (t) => {
  const out = await temporaryFolder(t);
  const built = spawnSync(process.execPath, [BUILD, out], { encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr);
  const { version } = JSON.parse(await readFile(PACKAGE, "utf8")) as { version: string };
  const bundle = path.join(out, `kiriya-${version}.mcpb`);
  assert.match(built.stdout, /SHA-256: [0-9a-f]{64}/);

  const unpacked = path.join(out, "unpacked");
  const unzipped = runKiriya(out, ["archive", "unzip", bundle, "--to", unpacked]);
  assert.equal(unzipped.code, 0, unzipped.stderr);
  const files = await filesIn(unpacked);
  for (const file of ["manifest.json", "package.json", "LICENSE", "dist/src/main.js"]) {
    assert.ok(files.includes(file), `${file} is in the bundle`);
  }
  assert.equal(
    files.some((file) => file.endsWith(".map") || file.startsWith("dist/tests") || file.startsWith("dist/tools")),
    false,
  );

  const manifest = JSON.parse(await readFile(path.join(unpacked, "manifest.json"), "utf8")) as {
    version: string;
    server: { mcp_config: { args: string[] } };
  };
  assert.equal(manifest.version, version);

  // The app replaces the bundle's directory and expands a list of folders into one argument each.
  const folders = [path.join(out, "first"), path.join(out, "second")];
  for (const folder of folders) await mkdir(folder);
  const args = manifest.server.mcp_config.args.flatMap((arg) =>
    arg === "${user_config.folders}" ? folders : [arg.replace("${__dirname}", unpacked)],
  );
  const { result, code } = await discover(args);
  assert.deepEqual(result["supportedVersions"], ["2026-07-28"]);
  assert.ok(String(result["instructions"]).includes(folders.join(", ")), String(result["instructions"]));
  assert.equal(code, 0);
});

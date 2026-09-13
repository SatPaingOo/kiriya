import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { runKiriya } from "../support/cli.js";
import { temporaryFolder } from "../support/fakes.js";

const EXAMPLE = fileURLToPath(new URL("../../../examples/plugins/hello", import.meta.url));

/** A temporary folder and an environment whose configuration file is inside it. */
async function configured(
  t: TestContext,
  contents: string | null,
): Promise<{ root: string; config: string; env: Record<string, string> }> {
  const root = await temporaryFolder(t);
  const config = path.join(root, "config.json");
  if (contents !== null) await writeFile(config, contents);
  return { root, config, env: { KIRIYA_NO_COLOR: "1", KIRIYA_CONFIG: config } };
}

test("a configured plugin adds a module whose command runs like a built-in one", async (t) => {
  const { root, env } = await configured(t, JSON.stringify({ plugins: [EXAMPLE] }));
  assert.deepEqual(runKiriya(root, ["hello", "greet", "Mya"], env), { code: 0, stdout: "Hello, Mya!\n", stderr: "" });
  const json = JSON.parse(runKiriya(root, ["hello", "greet", "Mya", "--json"], env).stdout) as {
    command: string;
    data: { name: string };
  };
  assert.deepEqual([json.command, json.data.name], ["hello.greet", "Mya"]);
  assert.match(runKiriya(root, [], env).stdout, /^ {2}hello /m);
});

test("doctor lists loaded plugins with their version, and fails on one that did not load", async (t) => {
  const { root, env } = await configured(t, JSON.stringify({ plugins: [EXAMPLE, "./missing"] }));
  const doctor = runKiriya(root, ["doctor", "--json"], env);
  assert.equal(doctor.code, 1);
  const json = JSON.parse(doctor.stdout) as {
    data: {
      plugins: Array<{ id: string; version: string }>;
      pluginProblems: Array<{ entry: string; reason: { key: string } }>;
    };
  };
  assert.deepEqual(
    json.data.plugins.map((plugin) => [plugin.id, plugin.version]),
    [["hello", "1.0.0"]],
  );
  assert.deepEqual(
    json.data.pluginProblems.map((problem) => [problem.entry, problem.reason.key]),
    [["./missing", "core.plugin.not-found"]],
  );
  assert.equal(runKiriya(root, ["files", "list"], env).code, 0, "built-in commands keep working");
});

test("a configuration file kiriya cannot read loads no plugins and breaks nothing else", async (t) => {
  const { root, env } = await configured(t, "{ nope");
  assert.equal(runKiriya(root, ["files", "list"], env).code, 0);
  const doctor = runKiriya(root, ["doctor"], env);
  assert.equal(doctor.code, 1);
  assert.match(doctor.stderr, /is not valid JSON/);
});

test("config set writes the file that config get and list read", async (t) => {
  const { root, config, env } = await configured(t, null);
  assert.equal(runKiriya(root, ["config", "path"], env).stdout, `${config}\n`);
  assert.equal(runKiriya(root, ["config", "set", "plugins", "one", "./two"], env).code, 0);
  assert.equal(runKiriya(root, ["config", "get", "plugins"], env).stdout, "one\n./two\n");
  assert.deepEqual(JSON.parse(await readFile(config, "utf8")), { plugins: ["one", "./two"] });
  assert.equal(runKiriya(root, ["config", "set", "plugins", "token=abc"], env).code, 1);
  assert.equal(runKiriya(root, ["config", "get", "nothing"], env).code, 1);
});

test("a module that is one command runs by its own name", async (t) => {
  const root = await temporaryFolder(t);
  assert.match(runKiriya(root, ["help", "doctor"]).stdout, /^ {2}kiriya doctor$/m);
  assert.equal(runKiriya(root, ["doctor", "unexpected"]).code, 2);
});

test("docker and git commands say what they need", async (t) => {
  const root = await temporaryFolder(t);
  const up = runKiriya(root, ["docker", "up"]);
  assert.equal(up.code, 1);
  assert.match(up.stderr, /No compose file in/);

  if (spawnSync("git", ["--version"]).status === 0) {
    const status = runKiriya(root, ["git", "status"]);
    assert.equal(status.code, 0);
    assert.match(status.stderr, /No git repositories within 3 folder level/);
  }
});

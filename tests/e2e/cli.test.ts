import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runKiriya as kiriya } from "../support/cli.js";
import { temporaryFolder } from "../support/fakes.js";

const PACKAGE = fileURLToPath(new URL("../../../package.json", import.meta.url));

test("--version prints the package version", async (t) => {
  const root = await temporaryFolder(t);
  const { version } = JSON.parse(await readFile(PACKAGE, "utf8")) as { version: string };
  assert.deepEqual(kiriya(root, ["--version"]), { code: 0, stdout: `${version}\n`, stderr: "" });
});

test("no arguments prints help listing the modules", async (t) => {
  const run = kiriya(await temporaryFolder(t), []);
  assert.equal(run.code, 0);
  assert.match(run.stdout, /^Modules$/m);
  assert.match(run.stdout, /^ {2}archive /m);
  assert.match(run.stdout, /^ {2}files /m);
});

test("usage errors exit 2 with a suggestion on stderr and nothing on stdout", async (t) => {
  const root = await temporaryFolder(t);
  const unknown = kiriya(root, ["fles"]);
  assert.equal(unknown.code, 2);
  assert.equal(unknown.stdout, "");
  assert.match(unknown.stderr, /Did you mean files\?/);
  const option = kiriya(root, ["files", "list", "--al"]);
  assert.equal(option.code, 2);
  assert.match(option.stderr, /Unknown option: --al\r?\nDid you mean --all\?/);
});

test("create, list as JSON, and delete for good", async (t) => {
  const root = await temporaryFolder(t);
  assert.equal(kiriya(root, ["files", "new", "notes.md", "--content", "hi"]).code, 0);
  assert.equal(await readFile(path.join(root, "notes.md"), "utf8"), "hi");

  const again = kiriya(root, ["files", "new", "notes.md"]);
  assert.equal(again.code, 1);
  assert.match(again.stderr, /Already exists/);

  const listed = kiriya(root, ["files", "list", "--json"]);
  assert.equal(listed.code, 0);
  const json = JSON.parse(listed.stdout) as {
    ok: boolean;
    command: string;
    data: { entries: Array<{ name: string }> };
  };
  assert.equal(json.ok, true);
  assert.equal(json.command, "files.list");
  assert.deepEqual(
    json.data.entries.map((entry) => entry.name),
    ["notes.md"],
  );

  const declined = kiriya(root, ["files", "delete", "notes.md", "--permanent", "--no-input"]);
  assert.equal(declined.code, 1);
  await access(path.join(root, "notes.md"));

  assert.equal(kiriya(root, ["files", "delete", "notes.md", "--permanent", "--confirm=2"]).code, 1, "wrong count");
  await access(path.join(root, "notes.md"));
  assert.equal(kiriya(root, ["files", "delete", "notes.md", "--permanent", "--confirm=1"]).code, 0);
  await assert.rejects(access(path.join(root, "notes.md")));
});

test("errors in JSON mode are JSON on stdout with the message key", async (t) => {
  const run = kiriya(await temporaryFolder(t), ["files", "delete", "missing.txt", "--json"]);
  assert.equal(run.code, 1);
  const json = JSON.parse(run.stdout) as { ok: boolean; error: { kind: string; message: { key: string } } };
  assert.equal(json.ok, false);
  assert.equal(json.error.kind, "not-found");
  assert.equal(json.error.message.key, "core.fs.not-found");
});

test("a preview says how to apply it on stderr, and JSON marks it as a preview", async (t) => {
  const root = await temporaryFolder(t);
  const text = kiriya(root, ["files", "clean"]);
  assert.equal(text.code, 0);
  const renamed = kiriya(root, ["files", "new", "Some File.txt"]);
  assert.equal(renamed.code, 0);
  const preview = kiriya(root, ["files", "rename", ".", "--case", "kebab"]);
  assert.equal(preview.code, 0);
  assert.match(preview.stderr, /Run again with --apply/);
  const json = JSON.parse(kiriya(root, ["files", "rename", ".", "--case", "kebab", "--json"]).stdout) as {
    kind: string;
    applyFlag: string;
  };
  assert.deepEqual([json.kind, json.applyFlag], ["preview", "--apply"]);
});

test("--no-color wins over FORCE_COLOR", async (t) => {
  const root = await temporaryFolder(t);
  assert.equal(kiriya(root, ["files"], { FORCE_COLOR: "1" }).stdout.includes("["), true);
  assert.equal(kiriya(root, ["files", "--no-color"], { FORCE_COLOR: "1" }).stdout.includes("["), false);
});

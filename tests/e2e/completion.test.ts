import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runKiriya } from "../support/cli.js";

const CWD = tmpdir();
const firstColumn = (stdout: string): string[] =>
  stdout
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.split("\t")[0] ?? "");

test("completion suggest answers with a value and a description on each line", () => {
  const modules = runKiriya(CWD, ["completion", "suggest", "--current=fi"]);
  assert.equal(modules.code, 0, modules.stderr);
  assert.match(modules.stdout, /^files\t\S/m);

  const choices = runKiriya(CWD, ["completion", "suggest", "--word=net", "--word=dns", "--word=--type", "--current="]);
  assert.equal(choices.code, 0, choices.stderr);
  assert.deepEqual(firstColumn(choices.stdout), ["system", "a", "aaaa", "cname", "mx", "txt", "ns"]);

  const globals = runKiriya(CWD, ["completion", "suggest", "--word=--json", "--current=--no-c"]);
  assert.deepEqual(firstColumn(globals.stdout), ["--no-color"]);
});

test("every supported shell has a script, and any other shell is a usage error", () => {
  for (const shell of ["bash", "zsh", "fish", "powershell"]) {
    const run = runKiriya(CWD, ["completion", shell]);
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, /kiriya completion suggest/);
  }
  assert.equal(runKiriya(CWD, ["completion", "tcsh"]).code, 2);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import type { RawInput } from "../../../src/core/domain/input-schema.js";
import { comparableFolder, entryFolder } from "../../../src/modules/env/application/path-entries.js";
import { ShowVariables, showSpec } from "../../../src/modules/env/application/show-variables.use-case.js";
import { parseDotenv } from "../../../src/modules/env/domain/dotenv.js";
import { expectDone, FakeEnvironment } from "../../support/fakes.js";

const raw = (positionals: readonly string[], options: RawInput["options"] = {}): RawInput => ({ positionals, options });

test("a .env file gives its keys, which of them are empty, and the lines that are not entries", () => {
  const text = [
    "# comment",
    "",
    "export API_URL=https://example.com # trailing comment",
    "EMPTY=",
    'QUOTED="a # inside quotes"',
    'MULTI="line one',
    'line two"',
    "SINGLE=''",
    "not an entry",
    "SPACED = value",
    "COMMENT_ONLY= # nothing",
    'UNCLOSED="never closed',
  ].join("\r\n");
  const parsed = parseDotenv(text);
  assert.deepEqual(
    parsed.entries.map((entry) => [entry.key, entry.line, entry.empty]),
    [
      ["API_URL", 3, false],
      ["EMPTY", 4, true],
      ["QUOTED", 5, false],
      ["MULTI", 6, false],
      ["SINGLE", 8, true],
      ["SPACED", 10, false],
      ["COMMENT_ONLY", 11, true],
    ],
  );
  assert.deepEqual(parsed.malformed, [9, 12]);
  assert.equal(parseDotenv(`${String.fromCharCode(0xfeff)}A=1`).entries[0]?.key, "A");
});

test("PATH entries compare the way each OS compares folders", () => {
  assert.equal(comparableFolder("C:/Tools/bin/", "windows"), comparableFolder("c:\\tools\\BIN", "windows"));
  assert.equal(comparableFolder("C:\\", "windows"), "c:\\");
  assert.equal(comparableFolder("/usr/local/bin/", "linux"), "/usr/local/bin");
  assert.equal(comparableFolder("/", "macos"), "/");
  assert.notEqual(comparableFolder("/opt/Bin", "linux"), comparableFolder("/opt/bin", "linux"));
});

test("on Windows an entry loses its quotes and expands %NAME%", () => {
  const variable = (name: string): string | undefined => (name === "SystemRoot" ? "C:\\Windows" : undefined);
  assert.equal(entryFolder('"%SystemRoot%\\System32"', "windows", variable), "C:\\Windows\\System32");
  assert.equal(entryFolder("%MISSING%\\bin", "windows", variable), "%MISSING%\\bin");
  assert.equal(entryFolder(" %SystemRoot% ", "linux", variable), "%SystemRoot%");
});

test("env show lists variables by name and hides values that look secret unless asked", async () => {
  const environment = new FakeEnvironment("linux", "/home/dev", {
    PATH: "/usr/bin",
    GITHUB_TOKEN: "ghp_example",
    DATABASE_URL: "postgres://app:example@db/app",
    home: "/home/dev",
    EDITOR: "vim",
  });
  const show = new ShowVariables(environment);
  const hidden = expectDone(await show.execute(showSpec.input.parse(raw([]))));
  assert.deepEqual(hidden.data.variables, [
    { name: "DATABASE_URL", value: null, secret: true },
    { name: "EDITOR", value: "vim", secret: false },
    { name: "GITHUB_TOKEN", value: null, secret: true },
    { name: "home", value: "/home/dev", secret: false },
    { name: "PATH", value: "/usr/bin", secret: false },
  ]);
  assert.equal(hidden.data.hidden, 2);
  assert.deepEqual(hidden.warnings, []);

  const revealed = expectDone(await show.execute(showSpec.input.parse(raw(["token"], { reveal: true }))));
  assert.deepEqual(revealed.data.variables, [{ name: "GITHUB_TOKEN", value: "ghp_example", secret: true }]);
  assert.deepEqual(
    revealed.warnings.map((warning) => warning.key),
    ["env.show.revealed"],
  );

  const none = expectDone(await show.execute(showSpec.input.parse(raw(["nothing-like-this"]))));
  assert.deepEqual(
    none.failures.map((failure) => failure.key),
    ["env.show.no-match"],
  );
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { decodeText } from "../../src/modules/files/domain/text-encoding.js";
import { runKiriya, type CliRun } from "../support/cli.js";
import { layout, temporaryFolder } from "../support/fakes.js";

type Files = (args: readonly string[], cwd?: string) => CliRun;

async function workspace(t: TestContext): Promise<{ root: string; files: Files }> {
  const root = await temporaryFolder(t);
  return { root, files: (args, cwd) => runKiriya(cwd ?? root, ["files", ...args]) };
}

const utf16 = (text: string): Buffer => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
const exists = (target: string): Promise<boolean> =>
  access(target).then(
    () => true,
    () => false,
  );

async function sources(root: string): Promise<void> {
  await layout(root, {
    "src/app.ts": "const answer = 42;\nconsole.log(answer);\n",
    ".env": "SECRET=1",
    "node_modules/pkg/index.js": "module.exports = 42;",
    "empty/": "",
  });
  await writeFile(path.join(root, "src", "big.bin"), Buffer.alloc(20_000, 1));
  await writeFile(path.join(root, "src", "legacy.sql"), utf16("SELECT 1\r\nFROM dbo.Answer\r\n"));
}

test("new creates files and folders and never touches an existing one", async (t) => {
  const { root, files } = await workspace(t);
  const created = files(["new", "docs/guide.md", "assets/", "--content", "# Guide"]);
  assert.equal(created.code, 0, created.stderr);
  assert.equal(await readFile(path.join(root, "docs", "guide.md"), "utf8"), "# Guide");
  assert.ok(await exists(path.join(root, "assets")));
  assert.equal(files(["new", "docs/guide.md"]).code, 1);
  assert.equal(await readFile(path.join(root, "docs", "guide.md"), "utf8"), "# Guide");
  assert.equal(files(["new", "bad:name.txt"]).code, 1);
});

test("list hides dot entries unless --all; tree lists dependency folders without opening them", async (t) => {
  const { root, files } = await workspace(t);
  await sources(root);
  const listed = files(["list"]);
  assert.equal(listed.code, 0);
  assert.match(listed.stdout, /directory .*src[/]/);
  assert.doesNotMatch(listed.stdout, /[.]env/);
  assert.match(files(["list", "--all"]).stdout, /[.]env/);

  const tree = files(["tree"]);
  assert.equal(tree.code, 0);
  assert.match(tree.stdout, /node_modules[/] +[(]not opened[)]/);
  assert.match(tree.stdout, /└── /);
  assert.doesNotMatch(tree.stdout, /index[.]js/);
});

test("find by name, extension, size and emptiness", async (t) => {
  const { root, files } = await workspace(t);
  await sources(root);
  assert.match(files(["find", "--name", "*.TS"]).stdout, /app[.]ts/);
  assert.match(files(["find", "--ext", "sql,bin", "--larger", "10KB"]).stdout, /^1 found/m);
  assert.match(files(["find", "--type", "dir", "--empty"]).stdout, /empty/);
  assert.doesNotMatch(files(["find", "--name", "index.js"]).stdout, /index[.]js/);
  assert.match(files(["find", "--name", "index.js", "--all"]).stdout, /index[.]js/);
});

test("grep searches UTF-8 and UTF-16 files and skips binary ones", async (t) => {
  const { root, files } = await workspace(t);
  await sources(root);
  const result = files(["grep", "answer", "--ignore-case"]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /app[.]ts:1: const answer = 42;/);
  assert.match(result.stdout, /legacy[.]sql:2: FROM dbo[.]Answer/);
  assert.match(result.stdout, /3 match[(]es[)] in 2 of 3 file[(]s[)] · 1 binary/);
  assert.equal(files(["grep", "(unclosed"]).code, 2);
  assert.match(files(["grep", "(unclosed", "--literal"]).stdout, /^0 match/m);
  const json = JSON.parse(files(["grep", "answer", "-i", "-l", "--json"]).stdout) as { data: { files: unknown[] } };
  assert.equal(json.data.files.length, 2);
});

test("read prints part of a text file and refuses a binary one", async (t) => {
  const { root, files } = await workspace(t);
  await sources(root);
  const result = files(["read", "src/legacy.sql", "--lines", "2-2", "--number"]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, "2  FROM dbo.Answer\n");
  assert.equal(files(["read", "src/big.bin"]).code, 1);
  assert.equal(files(["read", "src/app.ts", "--head", "1", "--tail", "1"]).code, 2);
});

test("hash prints checksums and checks a published one", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, { "abc.txt": "abc" });
  const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.match(files(["hash", "abc.txt"]).stdout, new RegExp(`^${expected}  abc[.]txt`));
  assert.equal(files(["hash", "abc.txt", "--check", expected.toUpperCase()]).code, 0);
  const mismatch = files(["hash", "abc.txt", "--check", "00"]);
  assert.equal(mismatch.code, 1);
  assert.match(mismatch.stderr, /does not match/);
});

test("info shows globs, a folder's total size, and hashes", async (t) => {
  const { root, files } = await workspace(t);
  await sources(root);
  const result = files(["info", "src", "src/*.ts", "--hash", "md5"]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /type +folder/);
  assert.match(result.stdout, /in 3 file[(]s[)]/);
  assert.match(result.stdout, /md5 +[0-9a-f]{32}/);
});

test("compare files and folders, and find byte-identical files", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, {
    "a/one.txt": "same\nfirst\n",
    "a/copy.txt": "same\nfirst\n",
    "b/one.txt": "same\nsecond\n",
    "b/extra.txt": "x",
  });
  assert.equal(files(["compare", "a/one.txt", "a/copy.txt"]).code, 0);
  const differ = files(["compare", "a/one.txt", "b/one.txt"]);
  assert.equal(differ.code, 1);
  assert.match(differ.stdout, /first at line 2/);

  const folders = files(["compare", "a", "b"]);
  assert.equal(folders.code, 1);
  assert.match(folders.stdout, /1 only in a, 1 only in b, 1 different/);

  const dupes = files(["dupes"]);
  assert.equal(dupes.code, 0);
  assert.match(dupes.stdout, /× 2/);
  assert.match(dupes.stdout, /1 group[(]s[)] of identical files/);
});

test("copy into a folder, and never replace without --overwrite and a typed confirmation", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, { "report.txt": "v1", "photos/Summer Trip.JPG": "jpg", "photos/winterTrip.jpg": "jpg" });
  assert.equal(files(["copy", "report.txt", "photos", "backup/"]).code, 0);
  assert.ok(await exists(path.join(root, "backup", "photos", "winterTrip.jpg")));

  await writeFile(path.join(root, "report.txt"), "v2");
  assert.equal(files(["copy", "report.txt", "backup/"]).code, 1);
  assert.equal(await readFile(path.join(root, "backup", "report.txt"), "utf8"), "v1");
  assert.equal(files(["copy", "report.txt", "backup/", "--overwrite"]).code, 1, "no terminal, no typed confirmation");
  assert.equal(files(["copy", "report.txt", "backup/", "--overwrite", "--confirm=1"]).code, 0);
  assert.equal(await readFile(path.join(root, "backup", "report.txt"), "utf8"), "v2");
  assert.equal(files(["copy", "photos", "photos/inner"]).code, 2);
});

test("move and rename, including a change of case alone and a bulk rename with a preview", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, {
    "report.txt": "v1",
    "readme.md": "# readme",
    "photos/Summer Trip.JPG": "jpg",
    "photos/winterTrip.jpg": "jpg",
  });
  assert.equal(files(["move", "readme.md", "README.md"]).code, 0);
  const names = await readdir(root);
  assert.ok(names.includes("README.md") && !names.includes("readme.md"));

  assert.equal(files(["rename", "report.txt", "summary.txt"]).code, 0);
  assert.ok(await exists(path.join(root, "summary.txt")));
  assert.equal(files(["rename", "summary.txt", "../escape.txt"]).code, 2);

  const preview = files(["rename", "photos", "--case", "kebab"]);
  assert.equal(preview.code, 0, preview.stderr);
  assert.match(preview.stdout, /Summer Trip[.]JPG -> summer-trip[.]JPG/);
  assert.ok(await exists(path.join(root, "photos", "Summer Trip.JPG")));
  assert.equal(files(["rename", "photos", "--case", "kebab", "--apply", "--yes"]).code, 0);
  assert.deepEqual((await readdir(path.join(root, "photos"))).sort(), ["summer-trip.JPG", "winter-trip.jpg"]);
});

test("rename changes nothing when two names would clash", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, { "clash/My Notes.txt": "a", "clash/my-notes.txt": "b" });
  assert.equal(files(["rename", "clash", "--case", "kebab", "--apply", "--yes"]).code, 1);
  assert.ok(await exists(path.join(root, "clash", "My Notes.txt")));
});

test("replace previews, then writes keeping encoding and line endings, with regex groups too", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, { "api/Program.cs": 'var name = "OldApi";\r\nConsole.WriteLine(name);\r\n' });
  await writeFile(path.join(root, "api", "query.sql"), utf16("USE [OldApi]\r\n"));

  const preview = files(["replace", "OldApi", "ShopApi"]);
  assert.equal(preview.code, 0, preview.stderr);
  assert.match(preview.stdout, /2 replacement[(]s[)] in 2 of 2 file[(]s[)]/);
  assert.ok((await readFile(path.join(root, "api", "Program.cs"), "utf8")).includes("OldApi"));

  assert.equal(files(["replace", "OldApi", "ShopApi", "--apply", "--yes"]).code, 0);
  assert.equal(
    await readFile(path.join(root, "api", "Program.cs"), "utf8"),
    'var name = "ShopApi";\r\nConsole.WriteLine(name);\r\n',
  );
  assert.deepEqual(decodeText(await readFile(path.join(root, "api", "query.sql"))), {
    text: "USE [ShopApi]\r\n",
    encoding: "utf16le",
  });

  assert.equal(files(["replace", "USE \\[(\\w+)\\]", "USE [$1Db]", "--regex", "--apply", "--yes"]).code, 0);
  assert.equal(decodeText(await readFile(path.join(root, "api", "query.sql")))?.text, "USE [ShopApiDb]\r\n");
});

test("delete refuses what it must, without a typed confirmation or on a protected path", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, { "keep.txt": "keep", "work/": "" });
  assert.equal(files(["delete", "keep.txt", "--permanent", "--yes"]).code, 1);
  assert.ok(await exists(path.join(root, "keep.txt")));
  assert.equal(files(["delete", "..", "--yes"], path.join(root, "work")).code, 1);
  assert.equal(files(["delete", "*.nothing", "--yes"]).code, 2);
  assert.ok(await exists(root));
});

test("clean lists only folders their project recreates, skips what git tracks, and removes nothing unconfirmed", async (t) => {
  const git = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (git.status !== 0) {
    t.skip("git is not installed");
    return;
  }
  const { root, files } = await workspace(t);
  await layout(root, {
    "web/package.json": "{}",
    "web/node_modules/pkg/index.js": "x".repeat(100),
    "web/dist/app.js": "x",
    "api/Api.csproj": "<Project />",
    "api/bin/Debug/Api.dll": "x",
    "api/obj/project.assets.json": "x",
    "scripts/bin/deploy.sh": "echo hand-written",
    "py/__pycache__/m.pyc": "x",
    "site/package.json": "{}",
    "site/dist/keep.js": "x",
  });
  const site = path.join(root, "site");
  for (const args of [
    ["init", "-q"],
    ["add", "-A"],
    ["commit", "-q", "-m", "chore: add built site"],
  ]) {
    const identity = ["-c", "user.name=kiriya-test", "-c", "user.email=kiriya-test@example.com"];
    const run = spawnSync("git", ["-C", site, ...identity, ...args], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
  }

  const listed = files(["clean"]);
  assert.equal(listed.code, 0, listed.stderr);
  for (const expected of [/web[/\\]node_modules/, /web[/\\]dist/, /api[/\\]bin/, /api[/\\]obj/, /py[/\\]__pycache__/]) {
    assert.match(listed.stdout, expected);
  }
  assert.doesNotMatch(listed.stdout, /scripts/);
  assert.match(listed.stdout, /5 rebuildable folder[(]s[)].*1 tracked by git/);
  assert.ok(await exists(path.join(root, "web", "node_modules")));

  assert.equal(files(["clean", "--apply"]).code, 1);
  assert.ok(await exists(path.join(root, "api", "bin", "Debug", "Api.dll")));
});

test("sync previews, copies, and deletes only with a typed confirmation", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, { "source/a.txt": "a", "source/sub/b.txt": "b", "target/old.txt": "old" });
  const preview = files(["sync", "source", "target", "--delete"]);
  assert.equal(preview.code, 0, preview.stderr);
  assert.match(preview.stdout, /2 to copy, 0 to update, 1 to delete/);
  assert.equal(await exists(path.join(root, "target", "a.txt")), false);

  assert.equal(files(["sync", "source", "target", "--apply", "--yes"]).code, 0);
  assert.equal(await readFile(path.join(root, "target", "sub", "b.txt"), "utf8"), "b");
  assert.match(files(["sync", "source", "target"]).stdout, /Already in sync/);

  assert.equal(files(["sync", "source", "target", "--delete", "--apply", "--yes"]).code, 1, "--yes is not enough");
  assert.ok(await exists(path.join(root, "target", "old.txt")));
  assert.equal(files(["sync", "source", "target", "--delete", "--apply", "--confirm=target"]).code, 0);
  assert.equal(await exists(path.join(root, "target", "old.txt")), false);
  assert.equal(files(["sync", "source", "source/sub"]).code, 2);
});

test("size lists the largest folders and calls out rebuildable ones", async (t) => {
  const { root, files } = await workspace(t);
  await layout(root, { "big/data.bin": "x".repeat(5000), "node_modules/dep/index.js": "x".repeat(100) });
  await mkdir(path.join(root, "nothing"));
  const result = files(["size"]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^ {2}big[/] /m);
  assert.match(result.stdout, /node_modules[/].*rebuildable/);
  const json = JSON.parse(files(["size", "--json"]).stdout) as { data: { rows: Array<{ name: string }> } };
  assert.deepEqual(
    json.data.rows.map((row) => row.name),
    ["big", "node_modules", "nothing"],
  );
});

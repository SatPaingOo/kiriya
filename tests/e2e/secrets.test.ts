import assert from "node:assert/strict";
import { test } from "node:test";
import { runKiriya as kiriya } from "../support/cli.js";
import { layout, temporaryFolder } from "../support/fakes.js";

const GITHUB = `ghp_${"b".repeat(20)}`;

test("scan finds the shapes a secret has, redacts them, and exits 1", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, {
    "app.ts": `const token = "${GITHUB}";\n`,
    // kiriya:allow-secret
    "aws.yml": "key: AKIAIOSFODNN7EXAMPLE\n",
    "prose.md": "This page is about passwords and tokens in general.\n",
  });

  const run = kiriya(root, ["secrets", "scan"]);
  assert.equal(run.code, 1, "something found means exit 1, so a hook needs no parsing");
  assert.match(run.stdout, /app\.ts:1:\d+\s+token\s+ghp_\*\*\*\*/);
  assert.match(run.stdout, /aws\.yml:1:\d+\s+token\s+AKIA\*\*\*\*/);
  assert.doesNotMatch(run.stdout, /prose\.md/, "prose about secrets is not a secret");
  assert.ok(!run.stdout.includes(GITHUB), "the output must never carry the secret itself");
});

test("a hidden file is read, because .env is where secrets actually are", async (t) => {
  const root = await temporaryFolder(t);
  // kiriya:allow-secret
  await layout(root, { ".env.backup": "DATABASE_URL=postgres://me:pw@db/app\n" });

  const run = kiriya(root, ["secrets", "scan"]);
  assert.equal(run.code, 1);
  assert.match(run.stdout, /url-credentials\s+postgres:\/\/me:\*\*\*\*@/);
  assert.ok(!run.stdout.includes("me:pw@"), "the password must not appear");
});

test("a dependency folder is left alone until --all asks for it", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "node_modules/pkg/leak.js": `const t = "${GITHUB}";\n` });

  const quiet = kiriya(root, ["secrets", "scan"]);
  assert.equal(quiet.code, 0, "what you installed is not what you committed");
  assert.match(quiet.stdout, /No secrets found/);

  const asked = kiriya(root, ["secrets", "scan", "--all"]);
  assert.equal(asked.code, 1);
  assert.match(asked.stdout, /leak\.js/);
});

test("a marker declares one deliberate, and the count says how many", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, {
    "fixture.ts": `const sample = "${GITHUB}"; // kiriya:allow-secret\n`,
    "above.ts": `// kiriya:allow-secret\nconst sample = "${GITHUB}";\n`,
  });

  const run = kiriya(root, ["secrets", "scan"]);
  assert.equal(run.code, 0, "everything excused means nothing to report");
  assert.match(run.stdout, /No secrets found/);
  assert.match(run.stdout, /2 marked deliberate/);
});

test("--json carries the same findings, redacted, for a script to read", async (t) => {
  const root = await temporaryFolder(t);
  await layout(root, { "app.ts": `const token = "${GITHUB}";\n` });

  const run = kiriya(root, ["secrets", "scan", "--json"]);
  assert.equal(run.code, 1);
  const parsed = JSON.parse(run.stdout) as {
    ok: boolean;
    data: { findings: { kind: string; sample: string; line: number; column: number }[]; checked: number };
  };
  assert.equal(parsed.ok, false, "a finding is a failure, as a declined confirmation is");
  assert.equal(parsed.data.findings.length, 1);
  assert.equal(parsed.data.findings[0]?.kind, "token");
  assert.equal(parsed.data.findings[0]?.sample, "ghp_****");
  assert.ok(!run.stdout.includes(GITHUB), "not even in JSON");
});

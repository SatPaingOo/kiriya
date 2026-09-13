import assert from "node:assert/strict";
import path from "node:path";
import { test, type TestContext } from "node:test";
import {
  CapabilityUnavailableError,
  NotFoundError,
  RefusedError,
  UsageError,
} from "../../../src/core/domain/errors.js";
import { NodeFileContentAdapter } from "../../../src/core/infrastructure/node/node-file-content.adapter.js";
import { NodeFileSystemAdapter } from "../../../src/core/infrastructure/node/node-file-system.adapter.js";
import { CleanEngine } from "../../../src/modules/docker/application/clean-engine.use-case.js";
import { ListContainers } from "../../../src/modules/docker/application/list-containers.use-case.js";
import { createUp } from "../../../src/modules/docker/application/run-compose.use-case.js";
import { logsSpec, ShowLogs } from "../../../src/modules/docker/application/show-logs.use-case.js";
import { StopProject } from "../../../src/modules/docker/application/stop-project.use-case.js";
import {
  commandContext,
  expectDone,
  FakeProcessRunner,
  layout,
  RecordingPassthrough,
  ScriptedConfirmation,
  temporaryFolder,
  type ScriptedRun,
} from "../../support/fakes.js";

const fileSystem = new NodeFileSystemAdapter();
const content = new NodeFileContentAdapter();

const COMPOSE = [
  "name: shop-local",
  "services:",
  "  api:",
  "    image: shop-api",
  "    ports:",
  '      - "8080:80"',
  "  db:",
  "    image: postgres:17",
].join("\n");

/** docker on PATH with a running engine, answering compose commands from `answer`. */
function engine(answer: (args: readonly string[]) => ScriptedRun = () => ({})): FakeProcessRunner {
  return new FakeProcessRunner({ docker: "/usr/bin/docker" }, (args) =>
    args[0] === "version" ? { stdout: "29.0.0\n" } : answer(args),
  );
}

async function project(t: TestContext): Promise<string> {
  const root = await temporaryFolder(t);
  await layout(root, { "compose.yaml": COMPOSE });
  return root;
}

const lastArgs = (runner: FakeProcessRunner): readonly string[] => runner.runs.at(-1)?.args ?? [];
const pinned = (root: string): string[] => [
  "compose",
  "--file",
  path.join(root, "compose.yaml"),
  "--project-directory",
  root,
];

test("up pins the compose file, streams docker's output, and lists the published ports", async (t) => {
  const root = await project(t);
  const runner = engine(() => ({ stdout: "Container shop-api Started\n", stderr: "pulling\n" }));
  const passthrough = new RecordingPassthrough();
  const result = expectDone(
    await createUp(fileSystem, content, runner).execute(
      { services: [], file: undefined, build: true },
      commandContext(root, new ScriptedConfirmation(true), passthrough),
    ),
  );
  assert.deepEqual(lastArgs(runner), [...pinned(root), "up", "--detach", "--build"]);
  assert.equal(runner.runs.at(-1)?.options.timeoutMs, 0);
  assert.deepEqual(passthrough.written, [
    { text: "Container shop-api Started\n", stream: "stdout" },
    { text: "pulling\n", stream: "stderr" },
  ]);
  assert.deepEqual(result.data.ports, [{ host: "8080", service: "api", target: "80" }]);
  assert.deepEqual(result.failures, []);

  const failed = expectDone(
    await createUp(
      fileSystem,
      content,
      engine(() => ({ code: 3 })),
    ).execute({ services: ["db"], file: undefined, build: false }, commandContext(root)),
  );
  assert.deepEqual(
    failed.failures.map((failure) => failure.key),
    ["docker.up.failed"],
  );
  assert.deepEqual(failed.data.ports, []);
});

test("docker must be installed and running, and a compose file must be found first", async (t) => {
  const root = await project(t);
  const input = { services: [], file: undefined, build: false };
  const needs = (key: string) => (error: unknown) =>
    error instanceof CapabilityUnavailableError && error.detail.key === key;
  await assert.rejects(
    createUp(fileSystem, content, new FakeProcessRunner({})).execute(input, commandContext(root)),
    needs("docker.not-installed"),
  );
  const stopped = new FakeProcessRunner({ docker: "/usr/bin/docker" }, () => ({ code: 1 }));
  await assert.rejects(
    createUp(fileSystem, content, stopped).execute(input, commandContext(root)),
    needs("docker.not-running"),
  );
  assert.equal(stopped.runs.length, 1, "only the engine probe ran");

  const empty = await temporaryFolder(t);
  const runner = engine();
  await assert.rejects(
    createUp(fileSystem, content, runner).execute(input, commandContext(empty)),
    (error: unknown) => error instanceof NotFoundError && error.detail.key === "docker.no-compose-file",
  );
  assert.equal(runner.runs.length, 0);

  await layout(empty, { "deploy/stack.yml": COMPOSE });
  await createUp(fileSystem, content, runner).execute({ ...input, file: "deploy/stack.yml" }, commandContext(empty));
  assert.deepEqual(lastArgs(runner).slice(0, 5), [
    "compose",
    "--file",
    path.join(empty, "deploy", "stack.yml"),
    "--project-directory",
    path.join(empty, "deploy"),
  ]);
});

test("down --volumes needs the project name typed, and removes volumes only then", async (t) => {
  const root = await project(t);
  const runner = engine();
  const command = new StopProject(fileSystem, content, runner);
  const refused = (key: string) => (error: unknown) => error instanceof RefusedError && error.detail.key === key;

  await assert.rejects(
    command.execute(
      { file: undefined, volumes: true, confirm: undefined },
      commandContext(root, new ScriptedConfirmation(false)),
    ),
    refused("core.confirm.declined"),
  );
  await assert.rejects(
    command.execute({ file: undefined, volumes: true, confirm: "other" }, commandContext(root)),
    refused("core.confirm.mismatch"),
  );
  assert.ok(
    runner.runs.every((run) => run.args[0] === "version"),
    "compose down never ran",
  );

  const result = expectDone(
    await command.execute({ file: undefined, volumes: true, confirm: "shop-local" }, commandContext(root)),
  );
  assert.deepEqual(lastArgs(runner), [...pinned(root), "down", "--volumes"]);
  assert.equal(result.data.volumes, true);
});

test("logs pass the tail and follow flags and the services through", async (t) => {
  const root = await project(t);
  const runner = engine();
  await new ShowLogs(fileSystem, content, runner).execute(
    { services: ["api"], file: undefined, follow: true, tail: "50" },
    commandContext(root),
  );
  assert.deepEqual(lastArgs(runner), [...pinned(root), "logs", "--tail", "50", "--follow", "api"]);
  assert.throws(
    () => logsSpec.input.parse({ positionals: [], options: { tail: "ten" } }),
    (error: unknown) => error instanceof UsageError && error.detail.key === "docker.logs.tail-invalid",
  );
});

test("ps lists the project's containers here, and every project where there is none", async (t) => {
  const root = await project(t);
  const runner = engine((args) =>
    args.includes("ls")
      ? { stdout: '[{"Name":"shop-local","Status":"running(1)","ConfigFiles":"/srv/compose.yaml"}]' }
      : { stdout: '{"Name":"shop-api","Service":"api","State":"running","Status":"Up","Ports":""}\n' },
  );
  const here = expectDone(
    await new ListContainers(fileSystem, content, runner).execute(
      { file: undefined, projects: false },
      commandContext(root),
    ),
  );
  assert.equal(here.data.mode, "project");
  assert.ok(here.data.mode === "project" && here.data.containers[0]?.name === "shop-api");

  const elsewhere = expectDone(
    await new ListContainers(fileSystem, content, runner).execute(
      { file: undefined, projects: false },
      commandContext(await temporaryFolder(t)),
    ),
  );
  assert.ok(elsewhere.data.mode === "projects" && elsewhere.data.projects[0]?.name === "shop-local");
});

test("clean previews without pruning, and prunes only after the typed word", async (t) => {
  const root = await temporaryFolder(t);
  const runner = engine((args) =>
    args[0] === "system"
      ? { stdout: '{"Type":"Images","TotalCount":"3","Active":"1","Size":"1GB","Reclaimable":"500MB"}\n' }
      : { stdout: "Total reclaimed space: 1.5GB\n" },
  );
  const command = new CleanEngine(runner);
  const prunes = (): string[] => runner.runs.filter((run) => run.args[1] === "prune").map((run) => run.args[0] ?? "");

  const previewed = await command.execute({ volumes: true, apply: false, confirm: undefined }, commandContext(root));
  assert.equal(previewed.kind, "preview");
  assert.equal(previewed.data.usage[0]?.reclaimable, "500MB");
  assert.deepEqual(prunes(), []);

  await assert.rejects(
    command.execute(
      { volumes: false, apply: true, confirm: undefined },
      commandContext(root, new ScriptedConfirmation(false)),
    ),
    RefusedError,
  );
  assert.deepEqual(prunes(), []);

  const cleaned = expectDone(
    await command.execute({ volumes: false, apply: true, confirm: "prune" }, commandContext(root)),
  );
  assert.deepEqual(prunes(), ["container", "image", "network", "builder"]);
  assert.deepEqual(
    cleaned.data.results.map((item) => [item.target, item.reclaimed]),
    [
      ["container", "1.5GB"],
      ["image", "1.5GB"],
      ["network", "1.5GB"],
      ["builder", "1.5GB"],
    ],
  );

  await command.execute({ volumes: true, apply: true, confirm: "prune" }, commandContext(root));
  assert.equal(prunes().at(-1), "volume");
});

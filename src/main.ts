#!/usr/bin/env node
/**
 * The composition root: the only file that constructs adapters and wires them in.
 * Choosing an adapter by operating system happens here and nowhere else.
 */
import { readFileSync } from "node:fs";
import { BUILT_IN_MODULES } from "./config/modules.js";
import { CommandRegistry } from "./core/application/command-registry.js";
import { PathGuard } from "./core/application/path-guard.js";
import type { CorePorts } from "./core/domain/module.js";
import type { Environment } from "./core/domain/ports/environment.js";
import type { Trash } from "./core/domain/ports/trash.js";
import { NodeCompressionAdapter } from "./core/infrastructure/node/node-compression.adapter.js";
import { NodeEnvironmentAdapter } from "./core/infrastructure/node/node-environment.adapter.js";
import { NodeFileContentAdapter } from "./core/infrastructure/node/node-file-content.adapter.js";
import { NodeFileSystemAdapter } from "./core/infrastructure/node/node-file-system.adapter.js";
import { NodeHasherAdapter } from "./core/infrastructure/node/node-hasher.adapter.js";
import { NodeProcessRunnerAdapter } from "./core/infrastructure/node/node-process-runner.adapter.js";
import { SystemClockAdapter } from "./core/infrastructure/node/system-clock.adapter.js";
import { FreedesktopTrashAdapter } from "./core/infrastructure/platform/linux/freedesktop-trash.adapter.js";
import { MacosTrashAdapter } from "./core/infrastructure/platform/macos/macos-trash.adapter.js";
import { WindowsTrashAdapter } from "./core/infrastructure/platform/windows/windows-trash.adapter.js";
import { CliApplication } from "./core/presentation/cli/cli-application.js";
import { en } from "./i18n/locales/en.js";

function trashFor(environment: Environment): Trash {
  switch (environment.os) {
    case "windows":
      return new WindowsTrashAdapter();
    case "macos":
      return new MacosTrashAdapter(environment);
    case "linux":
      return new FreedesktopTrashAdapter(environment);
  }
}

const environment = new NodeEnvironmentAdapter();
const ports: CorePorts = {
  fileSystem: new NodeFileSystemAdapter(),
  fileContent: new NodeFileContentAdapter(),
  hasher: new NodeHasherAdapter(),
  compression: new NodeCompressionAdapter(),
  processRunner: new NodeProcessRunnerAdapter(),
  trash: trashFor(environment),
  environment,
  clock: new SystemClockAdapter(),
  protectedPaths: new PathGuard(environment),
};

const registry = new CommandRegistry();
for (const module of BUILT_IN_MODULES) registry.register(module, ports);

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const cli = new CliApplication({
  registry,
  catalog: en,
  version,
  environment,
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
process.exitCode = await cli.run(process.argv.slice(2), process.cwd());

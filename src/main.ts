#!/usr/bin/env node
/**
 * The composition root: the only file that constructs adapters and wires them in.
 * Choosing an adapter by operating system happens here and nowhere else.
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { BUILT_IN_MODULES } from "./config/modules.js";
import { CommandRegistry } from "./core/application/command-registry.js";
import { pluginEntries } from "./core/application/config-values.js";
import { PathGuard } from "./core/application/path-guard.js";
import { PluginLoader } from "./core/application/plugin-loader.js";
import type { CorePorts } from "./core/domain/module.js";
import type { Clipboard } from "./core/domain/ports/clipboard.js";
import type { Environment } from "./core/domain/ports/environment.js";
import type { Opener } from "./core/domain/ports/opener.js";
import type { PortTable } from "./core/domain/ports/port-table.js";
import type { ProcessRunner } from "./core/domain/ports/process-runner.js";
import type { ProcessTable } from "./core/domain/ports/process-table.js";
import type { Trash } from "./core/domain/ports/trash.js";
import { ClosedStandardInput } from "./core/infrastructure/node/closed-standard-input.adapter.js";
import { configFilePath } from "./core/infrastructure/node/config-location.js";
import { JsonConfigStore } from "./core/infrastructure/node/json-config-store.adapter.js";
import { NodeCompressionAdapter } from "./core/infrastructure/node/node-compression.adapter.js";
import { NodeEnvironmentAdapter } from "./core/infrastructure/node/node-environment.adapter.js";
import { NodeFileContentAdapter } from "./core/infrastructure/node/node-file-content.adapter.js";
import { NodeFileSystemAdapter } from "./core/infrastructure/node/node-file-system.adapter.js";
import { NodeHasherAdapter } from "./core/infrastructure/node/node-hasher.adapter.js";
import { NodeNetworkAdapter } from "./core/infrastructure/node/node-network.adapter.js";
import { NodePluginSource } from "./core/infrastructure/node/node-plugin-source.adapter.js";
import { NodeProcessRunnerAdapter } from "./core/infrastructure/node/node-process-runner.adapter.js";
import { NodeRandomSource } from "./core/infrastructure/node/node-random-source.adapter.js";
import { NodeStandardInput } from "./core/infrastructure/node/node-standard-input.adapter.js";
import { NodeSystemInfoAdapter } from "./core/infrastructure/node/node-system-info.adapter.js";
import { SystemClockAdapter } from "./core/infrastructure/node/system-clock.adapter.js";
import { FreedesktopTrashAdapter } from "./core/infrastructure/platform/linux/freedesktop-trash.adapter.js";
import { LinuxClipboardAdapter } from "./core/infrastructure/platform/linux/linux-clipboard.adapter.js";
import { LinuxOpenerAdapter } from "./core/infrastructure/platform/linux/linux-opener.adapter.js";
import { LinuxPortTableAdapter } from "./core/infrastructure/platform/linux/linux-port-table.adapter.js";
import { LinuxProcessTableAdapter } from "./core/infrastructure/platform/linux/linux-process-table.adapter.js";
import { MacosClipboardAdapter } from "./core/infrastructure/platform/macos/macos-clipboard.adapter.js";
import { MacosOpenerAdapter } from "./core/infrastructure/platform/macos/macos-opener.adapter.js";
import { MacosPortTableAdapter } from "./core/infrastructure/platform/macos/macos-port-table.adapter.js";
import { MacosProcessTableAdapter } from "./core/infrastructure/platform/macos/macos-process-table.adapter.js";
import { MacosTrashAdapter } from "./core/infrastructure/platform/macos/macos-trash.adapter.js";
import { WindowsClipboardAdapter } from "./core/infrastructure/platform/windows/windows-clipboard.adapter.js";
import { WindowsOpenerAdapter } from "./core/infrastructure/platform/windows/windows-opener.adapter.js";
import { WindowsPortTableAdapter } from "./core/infrastructure/platform/windows/windows-port-table.adapter.js";
import { WindowsProcessTableAdapter } from "./core/infrastructure/platform/windows/windows-process-table.adapter.js";
import { WindowsTrashAdapter } from "./core/infrastructure/platform/windows/windows-trash.adapter.js";
import { splitGlobalFlags } from "./core/presentation/cli/argv.js";
import { CliApplication } from "./core/presentation/cli/cli-application.js";
import { serveMcp } from "./core/presentation/mcp/mcp-application.js";
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

function processTableFor(environment: Environment, processRunner: ProcessRunner): ProcessTable {
  switch (environment.os) {
    case "windows":
      return new WindowsProcessTableAdapter(processRunner);
    case "macos":
      return new MacosProcessTableAdapter(processRunner);
    case "linux":
      return new LinuxProcessTableAdapter();
  }
}

function portTableFor(environment: Environment, processRunner: ProcessRunner): PortTable {
  switch (environment.os) {
    case "windows":
      return new WindowsPortTableAdapter(processRunner);
    case "macos":
      return new MacosPortTableAdapter(processRunner);
    case "linux":
      return new LinuxPortTableAdapter();
  }
}

function clipboardFor(environment: Environment, processRunner: ProcessRunner): Clipboard {
  switch (environment.os) {
    case "windows":
      return new WindowsClipboardAdapter();
    case "macos":
      return new MacosClipboardAdapter();
    case "linux":
      return new LinuxClipboardAdapter(environment, processRunner);
  }
}

function openerFor(environment: Environment, processRunner: ProcessRunner): Opener {
  switch (environment.os) {
    case "windows":
      return new WindowsOpenerAdapter();
    case "macos":
      return new MacosOpenerAdapter();
    case "linux":
      return new LinuxOpenerAdapter(environment, processRunner);
  }
}

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};
const argv = process.argv.slice(2);
// Over MCP, stdin carries the protocol, so no command may read it.
const servingMcp = splitGlobalFlags(argv).rest[0] === "mcp";
const environment = new NodeEnvironmentAdapter();
const config = new JsonConfigStore(configFilePath(environment, process.cwd()));
const plugins = new PluginLoader();
const processRunner = new NodeProcessRunnerAdapter();
const registry = new CommandRegistry();
const ports: CorePorts = {
  fileSystem: new NodeFileSystemAdapter(),
  fileContent: new NodeFileContentAdapter(),
  hasher: new NodeHasherAdapter(),
  compression: new NodeCompressionAdapter(),
  processRunner,
  trash: trashFor(environment),
  environment,
  clock: new SystemClockAdapter(),
  random: new NodeRandomSource(),
  stdin: servingMcp ? new ClosedStandardInput() : new NodeStandardInput(),
  system: new NodeSystemInfoAdapter(environment, processRunner),
  network: new NodeNetworkAdapter(),
  processTable: processTableFor(environment, processRunner),
  portTable: portTableFor(environment, processRunner),
  clipboard: clipboardFor(environment, processRunner),
  opener: openerFor(environment, processRunner),
  commands: registry,
  protectedPaths: new PathGuard(environment),
  config,
  plugins,
  runtime: { kiriyaVersion: version, nodeVersion: process.version },
};

for (const module of BUILT_IN_MODULES) registry.register(module, ports);

// A configuration file kiriya cannot read loads no plugins; `kiriya doctor` and `kiriya config` report why.
const entries = await config.read().then(pluginEntries, () => []);
await plugins.load(entries, dirname(config.path), new NodePluginSource(), registry, ports);

const catalog = { ...en, ...plugins.messages };
const streams = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };
const cli = new CliApplication({
  registry,
  catalog,
  version,
  environment,
  ...streams,
  serveMcp: (input, cwd) =>
    serveMcp({ registry, catalog, version, fileSystem: ports.fileSystem, config, ...streams }, input, cwd),
});
process.exitCode = await cli.run(argv, process.cwd());

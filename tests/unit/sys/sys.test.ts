import assert from "node:assert/strict";
import { test } from "node:test";
import { CapabilityUnavailableError } from "../../../src/core/domain/errors.js";
import type { ProcessResult, ProcessRunner } from "../../../src/core/domain/ports/process-runner.js";
import type { SystemInfo, SystemSnapshot } from "../../../src/core/domain/ports/system-info.js";
import {
  prettyNameFromOsRelease,
  windowsName,
} from "../../../src/core/infrastructure/node/node-system-info.adapter.js";
import { CreateReport } from "../../../src/modules/sys/application/create-report.use-case.js";
import { FindTools } from "../../../src/modules/sys/application/find-tools.use-case.js";
import { ShowInfo } from "../../../src/modules/sys/application/show-info.use-case.js";
import { TOOLS, toolVersion, type ToolDefinition } from "../../../src/modules/sys/domain/tools.js";
import { commandContext, expectDone } from "../../support/fakes.js";

function tool(name: string): ToolDefinition {
  const found = TOOLS.find((entry) => entry.name === name);
  assert.ok(found, name);
  return found;
}

const printed = (stdout: string, code = 0): ProcessResult => ({ code, stdout, stderr: "" });

/** Programs found under /bin by name, each answering with its output; "cannot-start" fails to start. */
function runner(programs: Readonly<Record<string, ProcessResult | "cannot-start">>): ProcessRunner {
  return {
    find: (program) => Promise.resolve(program in programs ? `/bin/${program}` : null),
    run: (program) => {
      const answer = programs[program.slice("/bin/".length)];
      if (answer === undefined || answer === "cannot-start") {
        return Promise.reject(new CapabilityUnavailableError("core.process.cannot-start", { program }));
      }
      return Promise.resolve(answer);
    },
  };
}

test("each tool's version is read from what it prints, and stand-ins have none", () => {
  const samples: ReadonlyArray<readonly [string, string, string | null]> = [
    ["node", "v24.14.0\n", "24.14.0"],
    ["python", "Python 3.12.4\n", "3.12.4"],
    ["python", "Python was not found; run without arguments to install from the Microsoft Store.\n", null],
    ["dotnet", "8.0.404\n", "8.0.404"],
    ["dotnet", "The command could not be loaded.\n  No .NET SDKs were found.\n", null],
    ["java", 'openjdk version "21.0.2" 2024-01-16\nOpenJDK Runtime Environment\n', "21.0.2"],
    ["java", "The operation couldn't be completed. Unable to locate a Java Runtime.\n", null],
    ["go", "go version go1.23.2 linux/amd64\n", "1.23.2"],
    ["git", "git version 2.53.0.windows.1\n", "2.53.0.windows.1"],
    ["docker", "Docker version 29.7.2, build abc1234\n", "29.7.2"],
  ];
  for (const [name, output, expected] of samples) assert.equal(toolVersion(tool(name), output), expected, output);
});

test("sys tools tries the next program name after a stand-in, and survives a program that cannot start", async () => {
  const programs = runner({
    node: printed("v22.13.0\n"),
    python3: printed("", 9009),
    python: printed("Python 3.12.4\n"),
    git: "cannot-start",
    docker: printed("Docker version 29.7.2, build abc1234\n"),
  });
  const { data } = expectDone(await new FindTools(programs).execute({}, commandContext("/")));
  assert.deepEqual(data.tools, [
    { name: "node", version: "22.13.0", path: "/bin/node" },
    { name: "python", version: "3.12.4", path: "/bin/python" },
    { name: "dotnet", version: null, path: null },
    { name: "java", version: null, path: null },
    { name: "go", version: null, path: null },
    { name: "git", version: null, path: null },
    { name: "docker", version: "29.7.2", path: "/bin/docker" },
  ]);
});

const SNAPSHOT: SystemSnapshot = {
  os: "linux",
  osName: "Ubuntu 24.04.1 LTS",
  kernel: "6.8.0-45-generic",
  arch: "x64",
  cpuModel: "Example CPU",
  cpuCount: 8,
  memoryTotalBytes: 16 * 1024 ** 3,
  memoryFreeBytes: 4 * 1024 ** 3,
  uptimeSeconds: 90_061,
  hostname: "build-host-7",
  locale: "en-US",
  timeZone: "UTC",
};
const system: SystemInfo = { read: () => Promise.resolve(SNAPSHOT) };
const runtime = { kiriyaVersion: "1.2.3", nodeVersion: "v24.1.0" };

test("sys info names the host, and sys report leaves the host name and tool paths out", async () => {
  const info = expectDone(await new ShowInfo(system, runtime).execute());
  assert.deepEqual([info.data.hostname, info.data.uptimeSeconds, info.data.node], ["build-host-7", 90_061, "v24.1.0"]);

  const programs = runner({ git: printed("git version 2.50.0\n") });
  const report = expectDone(await new CreateReport(system, programs, runtime).execute({}, commandContext("/")));
  const text = JSON.stringify(report.data);
  assert.ok(!text.includes("build-host-7") && !text.includes("/bin/git"), text);
  assert.equal(report.data.machine.kiriya, "1.2.3");
  assert.deepEqual(
    report.data.tools.find((entry) => entry.name === "git"),
    { name: "git", version: "2.50.0", path: null },
  );
});

test("the OS name comes from os-release on Linux, and Windows builds from 22000 are Windows 11", () => {
  const osRelease = 'NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\nID=ubuntu\n';
  assert.equal(prettyNameFromOsRelease(osRelease), "Ubuntu 24.04.1 LTS");
  assert.equal(prettyNameFromOsRelease("ID=alpine\n"), null);
  assert.equal(windowsName("Windows 10 Pro", "10.0.26100"), "Windows 11 Pro");
  assert.equal(windowsName("Windows 10 Pro", "10.0.19045"), "Windows 10 Pro");
});

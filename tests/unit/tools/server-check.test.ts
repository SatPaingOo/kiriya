import assert from "node:assert/strict";
import { test } from "node:test";
import { serverProblems } from "../../../tools/server-check.js";

const MANIFEST = { name: "kiriya", version: "0.1.0", mcpName: "io.github.SatPaingOo/kiriya" };

const NPM_PACKAGE = {
  registryType: "npm",
  identifier: "kiriya",
  version: "0.1.0",
  transport: { type: "stdio" },
  packageArguments: [{ type: "positional", value: "mcp" }],
};

const SERVER = {
  name: "io.github.SatPaingOo/kiriya",
  description: "Developer tools, the same on Windows, Linux and macOS",
  version: "0.1.0",
  packages: [NPM_PACKAGE],
};

test("a server.json that names the package, its version and mcpName as package.json does passes", () => {
  assert.deepEqual(serverProblems(MANIFEST, SERVER), []);
});

test("everything that would make the registry refuse the server or point at the wrong package is named", () => {
  const problems = serverProblems(
    { name: "kiriya", version: "0.2.0" },
    {
      ...SERVER,
      description: "x".repeat(101),
      packages: [{ ...NPM_PACKAGE, identifier: "other", transport: { type: "sse" }, packageArguments: [] }],
    },
  );
  assert.deepEqual(problems, [
    'package.json has no "mcpName", which the registry checks on npm',
    "server.json needs a description of 1 to 100 characters",
    "server.json has version 0.1.0, but package.json has 0.2.0",
    "server.json's npm package is other, not kiriya",
    "server.json's npm package has version 0.1.0, but package.json has 0.2.0",
    "server.json's npm package does not use the stdio transport",
    'server.json does not start the package with the argument "mcp"',
  ]);
});

test("a name that differs from mcpName, a server without an npm package, and anything but an object are refused", () => {
  assert.deepEqual(serverProblems(MANIFEST, { ...SERVER, name: "io.github.someone/kiriya", packages: [] }), [
    "server.json is named io.github.someone/kiriya, but package.json's mcpName is io.github.SatPaingOo/kiriya",
    "server.json lists no npm package",
  ]);
  assert.deepEqual(serverProblems(MANIFEST, []), ["server.json is not a JSON object"]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { bundleManifest, runtimePackage } from "../../../tools/mcpb-manifest.js";

const PACKAGE = {
  name: "kiriya",
  version: "0.1.0",
  description: "One command-line toolbox.",
  author: "Sat Paing Oo",
  license: "MIT",
  homepage: "https://github.com/SatPaingOo/kiriya#readme",
  keywords: ["cli"],
  repository: { url: "git+https://github.com/SatPaingOo/kiriya.git" },
  bugs: { url: "https://github.com/SatPaingOo/kiriya/issues" },
  engines: { node: ">=22.13" },
};

test("the bundle manifest comes from package.json and starts kiriya mcp on the folders the user picks", () => {
  assert.deepEqual(bundleManifest(PACKAGE), {
    manifest_version: "0.3",
    name: "kiriya",
    display_name: "kiriya",
    version: "0.1.0",
    description: "One command-line toolbox.",
    author: { name: "Sat Paing Oo" },
    repository: { type: "git", url: "https://github.com/SatPaingOo/kiriya.git" },
    homepage: "https://github.com/SatPaingOo/kiriya#readme",
    support: "https://github.com/SatPaingOo/kiriya/issues",
    license: "MIT",
    keywords: ["cli"],
    server: {
      type: "node",
      entry_point: "dist/src/main.js",
      mcp_config: {
        command: "node",
        args: ["${__dirname}/dist/src/main.js", "mcp", "${user_config.folders}"],
        env: {},
      },
    },
    tools_generated: true,
    compatibility: { platforms: ["darwin", "win32", "linux"], runtimes: { node: ">=22.13" } },
    user_config: {
      folders: {
        type: "directory",
        title: "Folders",
        description: "The folders kiriya's tools may reach. Paths outside them are refused.",
        multiple: true,
        required: true,
      },
    },
  });
});

test("fields package.json leaves out stay out of the manifest, and the bundle's package.json is minimal", () => {
  const manifest = bundleManifest({ name: "kiriya", version: "0.1.0", description: "Tools." });
  assert.deepEqual(manifest["author"], { name: "kiriya" });
  for (const field of ["repository", "homepage", "support", "license"]) assert.equal(field in manifest, false, field);
  assert.deepEqual(manifest["compatibility"], { platforms: ["darwin", "win32", "linux"] });
  assert.deepEqual(runtimePackage(PACKAGE), { name: "kiriya", version: "0.1.0", type: "module", license: "MIT" });
});

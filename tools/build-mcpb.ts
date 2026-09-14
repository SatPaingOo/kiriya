/**
 * Builds kiriya's MCP Bundle from the built program: `node dist/tools/build-mcpb.js [folder]`
 * after `npm run build`. kiriya packs the bundle with its own `archive zip`, so the bundle is
 * made the way users' own archives are, and prints the file and its SHA-256.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleManifest, runtimePackage, type PackageManifest } from "./mcpb-manifest.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(ROOT, "dist", "mcpb"));
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as PackageManifest;
const staging = path.join(out, "bundle");
const bundle = path.join(out, `${pkg.name}-${pkg.version}.mcpb`);
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

rmSync(out, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
cpSync(path.join(ROOT, "dist", "src"), path.join(staging, "dist", "src"), {
  recursive: true,
  filter: (source) => !source.endsWith(".map"),
});
cpSync(path.join(ROOT, "LICENSE"), path.join(staging, "LICENSE"));
writeFileSync(path.join(staging, "package.json"), json(runtimePackage(pkg)));
writeFileSync(path.join(staging, "manifest.json"), json(bundleManifest(pkg)));

const zipped = spawnSync(
  process.execPath,
  [
    path.join(ROOT, "dist", "src", "main.js"),
    "archive",
    "zip",
    "dist",
    "LICENSE",
    "manifest.json",
    "package.json",
    "--to",
    bundle,
  ],
  {
    cwd: staging,
    encoding: "utf8",
    // No one's own settings or plugins take part in building the bundle.
    env: { ...process.env, KIRIYA_CONFIG: path.join(out, "no-config.json"), KIRIYA_NO_COLOR: "1" },
  },
);
if (zipped.status !== 0) {
  console.error(zipped.stderr);
  console.error(`MCP bundle: kiriya archive zip exited with ${String(zipped.status)}`);
  process.exitCode = 1;
} else {
  const sha256 = createHash("sha256").update(readFileSync(bundle)).digest("hex");
  console.log(`MCP bundle: ${bundle}`);
  console.log(`SHA-256: ${sha256}`);
}

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NotFoundError, OperationFailedError } from "../../domain/errors.js";
import type { PluginPackage, PluginSource } from "../../domain/ports/plugin-source.js";

interface Manifest {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly main?: unknown;
  readonly exports?: unknown;
}

const PACKAGE_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

async function kindOf(target: string): Promise<"file" | "directory" | null> {
  try {
    const found = await stat(target);
    return found.isDirectory() ? "directory" : found.isFile() ? "file" : null;
  } catch {
    return null;
  }
}

async function manifestOf(folder: string): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(path.join(folder, "package.json"), "utf8")) as Manifest;
  } catch {
    return null;
  }
}

const field = (value: unknown, name: string): unknown =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[name] : undefined;

/** A package folder's ES module entry: its "." export, then "main", then index.js. */
function entryFile(folder: string, manifest: Manifest | null): string {
  const root = typeof manifest?.exports === "string" ? manifest.exports : field(manifest?.exports, ".");
  const conditional = typeof root === "string" ? root : (field(root, "import") ?? field(root, "default"));
  if (typeof conditional === "string") return path.resolve(folder, conditional);
  if (typeof manifest?.main === "string") return path.resolve(folder, manifest.main);
  return path.join(folder, "index.js");
}

/**
 * Where a package name may be installed: node_modules above kiriya itself, which is
 * where global installs sit side by side, then node_modules above the configuration file.
 */
function packageFolders(name: string, baseDirectory: string): string[] {
  const folders: string[] = [];
  for (const start of [path.dirname(fileURLToPath(import.meta.url)), baseDirectory]) {
    for (let current = start; ; current = path.dirname(current)) {
      folders.push(path.join(current, "node_modules", name));
      if (path.dirname(current) === current) break;
    }
  }
  return folders;
}

export class NodePluginSource implements PluginSource {
  async load(entry: string, baseDirectory: string): Promise<PluginPackage> {
    let folder: string | null = null;
    let file: string | null = null;
    if (entry.startsWith(".") || path.isAbsolute(entry)) {
      const target = path.resolve(baseDirectory, entry);
      const kind = await kindOf(target);
      if (kind === "file") file = target;
      if (kind === "directory") folder = target;
    } else if (PACKAGE_NAME.test(entry)) {
      for (const candidate of packageFolders(entry, baseDirectory)) {
        if ((await kindOf(candidate)) === "directory") {
          folder = candidate;
          break;
        }
      }
    }
    if (folder === null && file === null) throw new NotFoundError("core.plugin.not-found", { entry });

    const manifest = folder === null ? null : await manifestOf(folder);
    const location = file ?? entryFile(folder ?? "", manifest);
    let exports: unknown;
    try {
      exports = await import(pathToFileURL(location).href);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new OperationFailedError("core.plugin.import-failed", { entry, detail }, { cause: error });
    }
    return {
      location,
      name: typeof manifest?.name === "string" ? manifest.name : null,
      version: typeof manifest?.version === "string" ? manifest.version : null,
      exports,
    };
  }
}

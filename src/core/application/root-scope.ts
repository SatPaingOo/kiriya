import path from "node:path";
import { NotFoundError, RefusedError } from "../domain/errors.js";
import { hasGlob } from "../domain/glob.js";
import type { InputSchema, RawInput } from "../domain/input-schema.js";
import type { FileSystem } from "../domain/ports/file-system.js";
import { isInside } from "./paths.js";

/** Every value given for an input the command marks as a path. */
export function pathValues(schema: InputSchema<unknown>, raw: RawInput): string[] {
  const values: string[] = [];
  schema.positionals.forEach((positional, index) => {
    if (positional.path !== true) return;
    values.push(...raw.positionals.slice(index, positional.variadic ? undefined : index + 1));
  });
  for (const [name, option] of Object.entries(schema.options)) {
    const value = raw.options[name];
    if (option.path !== true || value === undefined || typeof value === "boolean") continue;
    values.push(...(typeof value === "string" ? [value] : value));
  }
  return values;
}

/**
 * The folders an MCP client may reach. A path is inside when it lies under a root both
 * as written and with every symlink followed, so neither `..` nor a link leads out.
 */
export class RootScope {
  private constructor(
    private readonly fileSystem: FileSystem,
    /** Where relative paths start: the first root. */
    readonly start: string,
    readonly roots: readonly string[],
    private readonly realRoots: readonly string[],
  ) {}

  /** Folders resolve against `cwd`, which is the only root when none is given. Each must be a folder that exists. */
  static async open(fileSystem: FileSystem, folders: readonly string[], cwd: string): Promise<RootScope> {
    const roots = [...new Set((folders.length === 0 ? [cwd] : folders).map((folder) => path.resolve(cwd, folder)))];
    const realRoots: string[] = [];
    for (const root of roots) {
      if ((await fileSystem.stat(root))?.kind !== "directory")
        throw new NotFoundError("core.mcp.root-missing", { path: root });
      realRoots.push((await fileSystem.realPath(root)) ?? root);
    }
    return new RootScope(fileSystem, roots[0] ?? path.resolve(cwd), roots, realRoots);
  }

  /** RefusedError for the first value that leads outside every root. */
  async refuseOutside(values: readonly string[]): Promise<void> {
    for (const value of values) {
      for (const candidate of this.candidates(value)) {
        const real = await this.real(candidate);
        if (!this.within(candidate, this.roots) || real === null || !this.within(real, this.realRoots)) {
          throw new RefusedError("core.mcp.outside-roots", { path: value, roots: this.roots.join(", ") });
        }
      }
    }
  }

  /** The path as written and, for a glob, the folder its expansion starts in, found the way `expandPaths` finds it. */
  private candidates(value: string): string[] {
    const whole = path.resolve(this.start, value);
    if (!hasGlob(value)) return [whole];
    const segments = (path.sep === "\\" ? value.split("\\").join("/") : value).split("/");
    const firstGlob = segments.findIndex((segment) => hasGlob(segment));
    return [whole, path.resolve(this.start, segments.slice(0, firstGlob).join("/") || ".")];
  }

  /**
   * The path with the links of every part that exists followed. Null when an entry
   * exists but cannot be followed, such as a link that leads nowhere, since writing
   * through it would create whatever it names.
   */
  private async real(target: string): Promise<string | null> {
    const missing: string[] = [];
    let current = target;
    for (;;) {
      const real = await this.fileSystem.realPath(current);
      if (real !== null) return path.join(real, ...missing);
      if ((await this.fileSystem.lstat(current)) !== null) return null;
      const parent = path.dirname(current);
      if (parent === current) return null;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }

  private within(target: string, roots: readonly string[]): boolean {
    return roots.some((root) => isInside(target, root));
  }
}

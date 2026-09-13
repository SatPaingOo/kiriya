import path from "node:path";
import { PROTECTED_PATHS } from "../../config/protected-paths.js";
import { message, type Message } from "../domain/message.js";
import type { Environment } from "../domain/ports/environment.js";
import type { ProtectedPaths } from "../domain/ports/protected-paths.js";

/**
 * Drive roots, the home folder, the working folder and its parents, and
 * operating-system folders. Uses the path rules of the environment's OS, so
 * Windows rules can be tested anywhere.
 */
export class PathGuard implements ProtectedPaths {
  private readonly paths: path.PlatformPath;
  private readonly caseInsensitive: boolean;

  constructor(private readonly environment: Environment) {
    this.paths = environment.os === "windows" ? path.win32 : path.posix;
    this.caseInsensitive = environment.os !== "linux";
  }

  reasonFor(target: string, cwd: string): Message | null {
    const resolved = this.paths.resolve(target);
    if (resolved === this.paths.parse(resolved).root) return message("core.guard.drive-root", { path: resolved });
    if (this.same(resolved, this.paths.resolve(this.environment.homeDirectory))) {
      return message("core.guard.home", { path: resolved });
    }
    if (this.isInside(this.paths.resolve(cwd), resolved))
      return message("core.guard.working-folder", { path: resolved });

    for (const folder of this.insideFolders()) {
      if (this.isInside(resolved, folder)) return message("core.guard.system-folder", { path: resolved, folder });
    }
    for (const folder of this.exactFolders(resolved)) {
      if (this.same(resolved, folder)) return message("core.guard.system-location", { path: resolved, folder });
    }
    return null;
  }

  private insideFolders(): readonly string[] {
    if (this.environment.os !== "windows") return PROTECTED_PATHS.posix.inside;
    return this.fromVariables(PROTECTED_PATHS.windows.insideVariables);
  }

  private exactFolders(target: string): readonly string[] {
    if (this.environment.os !== "windows") return PROTECTED_PATHS.posix.exact;
    const root = this.paths.parse(target).root;
    return [
      ...this.fromVariables(PROTECTED_PATHS.windows.exactVariables),
      ...PROTECTED_PATHS.windows.exactOnDrive.map((name) => this.paths.join(root, name)),
    ];
  }

  private fromVariables(names: readonly string[]): string[] {
    return names
      .map((name) => this.environment.variable(name))
      .filter((value): value is string => value !== undefined && value !== "")
      .map((value) => this.paths.resolve(value));
  }

  private normalize(value: string): string {
    return this.caseInsensitive ? value.toLowerCase() : value;
  }

  private same(a: string, b: string): boolean {
    return this.normalize(a) === this.normalize(b);
  }

  /** True when `child` is `parent` or anywhere below it. */
  private isInside(child: string, parent: string): boolean {
    const relative = this.paths.relative(this.normalize(parent), this.normalize(child));
    return relative === "" || (!relative.startsWith("..") && !this.paths.isAbsolute(relative));
  }
}

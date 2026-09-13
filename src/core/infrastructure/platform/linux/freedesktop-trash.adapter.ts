import { constants } from "node:fs";
import { access, cp, lstat, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { message } from "../../../domain/message.js";
import type { Environment } from "../../../domain/ports/environment.js";
import type { Trash, TrashOutcome } from "../../../domain/ports/trash.js";

const NEWLINE = String.fromCharCode(10);

interface TrashDirectory {
  readonly root: string;
  /** The top of the other mount, or null for the home trash. */
  readonly topdir: string | null;
  /** The home trash on another device: the file is copied, then removed. */
  readonly copy: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function localTime(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * The freedesktop.org trash specification implemented directly, so files on other
 * mounts work where `gio trash` refuses them. Verified in the phase 0 spike.
 */
export class FreedesktopTrashAdapter implements Trash {
  readonly location = "core.trash.location.freedesktop";

  constructor(private readonly environment: Environment) {}

  async send(paths: readonly string[]): Promise<readonly TrashOutcome[]> {
    const outcomes: TrashOutcome[] = [];
    for (const path of paths) outcomes.push(await this.sendOne(path));
    return outcomes;
  }

  private homeTrash(): string {
    const dataHome = this.environment.variable("XDG_DATA_HOME");
    return join(
      dataHome !== undefined && isAbsolute(dataHome)
        ? dataHome
        : join(this.environment.homeDirectory, ".local", "share"),
      "Trash",
    );
  }

  private async prepare(root: string): Promise<void> {
    await mkdir(join(root, "files"), { recursive: true, mode: 0o700 });
    await mkdir(join(root, "info"), { recursive: true, mode: 0o700 });
  }

  private async directoryFor(path: string): Promise<TrashDirectory> {
    const home = this.homeTrash();
    await this.prepare(home);
    const device = (await lstat(path)).dev;
    if (device === (await stat(home)).dev) return { root: home, topdir: null, copy: false };

    let topdir = resolve(dirname(path));
    while (dirname(topdir) !== topdir && (await stat(dirname(topdir))).dev === device) topdir = dirname(topdir);
    const uid = process.getuid?.() ?? 0;
    try {
      const shared = await lstat(join(topdir, ".Trash"));
      if (shared.isDirectory() && !shared.isSymbolicLink() && (shared.mode & 0o1000) !== 0) {
        const root = join(topdir, ".Trash", String(uid));
        await this.prepare(root);
        return { root, topdir, copy: false };
      }
    } catch {
      // no shared trash on this mount
    }
    try {
      const root = join(topdir, `.Trash-${uid}`);
      await this.prepare(root);
      return { root, topdir, copy: false };
    } catch {
      return { root: home, topdir: null, copy: true };
    }
  }

  private async freeName(root: string, name: string): Promise<string> {
    const extension = extname(name);
    const stem = name.slice(0, name.length - extension.length);
    for (let attempt = 1; ; attempt += 1) {
      const candidate = attempt === 1 ? name : `${stem}.${attempt}${extension}`;
      if (
        !(await exists(join(root, "files", candidate))) &&
        !(await exists(join(root, "info", `${candidate}.trashinfo`)))
      ) {
        return candidate;
      }
    }
  }

  private async sendOne(path: string): Promise<TrashOutcome> {
    let info: string | undefined;
    try {
      const target = await this.directoryFor(path);
      const name = await this.freeName(target.root, basename(path));
      info = join(target.root, "info", `${name}.trashinfo`);
      const recorded = target.topdir === null ? resolve(path) : relative(target.topdir, resolve(path));
      const encoded = recorded.split(sep).map(encodeURIComponent).join("/");
      await writeFile(
        info,
        ["[Trash Info]", `Path=${encoded}`, `DeletionDate=${localTime(new Date())}`, ""].join(NEWLINE),
        {
          flag: "wx",
        },
      );
      const destination = join(target.root, "files", name);
      if (target.copy) {
        await cp(path, destination, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
        await rm(path, { recursive: true, force: true });
      } else {
        await rename(path, destination);
      }
      return { path, ok: true };
    } catch (error) {
      if (info !== undefined) await rm(info, { force: true });
      const code = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
      return { path, ok: false, reason: message("core.trash.failed", { detail: code }) };
    }
  }
}

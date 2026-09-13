import path from "node:path";
import type { OsFamily } from "../../../core/domain/ports/environment.js";

/** `;` on Windows and `:` elsewhere, whichever OS kiriya runs on. */
export function listSeparator(os: OsFamily): string {
  return os === "windows" ? ";" : ":";
}

function flavour(os: OsFamily): path.PlatformPath {
  return os === "windows" ? path.win32 : path.posix;
}

/** The folder an entry names: on Windows without surrounding quotes and with `%NAME%` expanded; unknown names stay. */
export function entryFolder(entry: string, os: OsFamily, variable: (name: string) => string | undefined): string {
  const trimmed = entry.trim();
  if (os !== "windows") return trimmed;
  return trimmed.replace(/^"(.*)"$/, "$1").replace(/%([^%]+)%/g, (whole, name: string) => variable(name) ?? whole);
}

export function isAbsoluteFolder(folder: string, os: OsFamily): boolean {
  return flavour(os).isAbsolute(folder);
}

/** The form two folders share when they are the same: normalised, without a trailing separator, and on Windows in lower case. */
export function comparableFolder(folder: string, os: OsFamily): string {
  const paths = flavour(os);
  let normal = paths.normalize(folder);
  const root = paths.parse(normal).root;
  while (normal.length > root.length && normal.endsWith(paths.sep)) normal = normal.slice(0, -1);
  return os === "windows" ? normal.toLowerCase() : normal;
}

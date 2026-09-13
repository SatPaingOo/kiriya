import type { OsFamily } from "../../../core/domain/ports/environment.js";

/** Web and mail addresses; every other scheme can start programs or reach places a file name should not. */
export const OPENABLE_SCHEMES: readonly string[] = ["http", "https", "mailto"];

export type Target =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "refused"; readonly scheme: string };

/** A scheme at the start makes an address; a Windows drive such as C:\ does not. */
export function classifyTarget(text: string): Target {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1];
  if (scheme === undefined || /^[a-z]:([\\/]|$)/i.test(text)) return { kind: "path", path: text };
  const lower = scheme.toLowerCase();
  return OPENABLE_SCHEMES.includes(lower) ? { kind: "url", url: text } : { kind: "refused", scheme: lower };
}

/** Names that each OS runs as a program, or as a script or installer, when they are opened. */
const RUNS_WHEN_OPENED: Readonly<Record<OsFamily, readonly string[]>> = {
  windows: [
    ".exe",
    ".com",
    ".bat",
    ".cmd",
    ".ps1",
    ".psm1",
    ".vbs",
    ".vbe",
    ".js",
    ".jse",
    ".wsf",
    ".wsh",
    ".msi",
    ".msc",
    ".scr",
    ".lnk",
    ".url",
    ".hta",
    ".cpl",
    ".reg",
    ".jar",
    ".pif",
    ".appref-ms",
  ],
  macos: [".app", ".command", ".tool", ".terminal", ".pkg", ".workflow", ".jar"],
  linux: [".desktop", ".appimage", ".jar"],
};

export function runsWhenOpened(name: string, os: OsFamily): boolean {
  const lower = name.toLowerCase();
  return RUNS_WHEN_OPENED[os].some((extension) => lower.endsWith(extension));
}

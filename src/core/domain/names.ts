import type { MessageKey } from "../../i18n/locales/en.js";

export function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}

/** Code-point order: unlike localeCompare, the same on every OS and in every locale. */
export function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const FORBIDDEN = /[/\\<>:"|?*]/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])([.].*)?$/i;

/** Why a new name would not work on Windows, Linux and macOS alike, or null when it would. */
export function invalidNameReason(name: string): MessageKey | null {
  if (name === "" || name === "." || name === "..") return "core.name.empty";
  if (FORBIDDEN.test(name) || [...name].some((char) => char.charCodeAt(0) < 32)) return "core.name.characters";
  if (/[. ]$/.test(name)) return "core.name.trailing";
  if (RESERVED.test(name)) return "core.name.reserved";
  return null;
}

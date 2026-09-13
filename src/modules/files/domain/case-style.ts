import { isHiddenName } from "../../../core/domain/names.js";
import { toCase } from "../../../core/domain/text-case.js";

/** The cases a file name can take; `constant` and `title` suit text better than names. */
export const CASE_STYLES = ["kebab", "snake", "camel", "pascal", "lower", "upper"] as const;
export type CaseStyle = (typeof CASE_STYLES)[number];

/**
 * A name in another case. Only the part before the first dot changes, so suffixes
 * and extensions stay (`UserService.test.ts` -> `user-service.test.ts`) and
 * dotfiles such as `.gitignore` keep their name.
 */
export function renameByCase(name: string, style: CaseStyle): string {
  if (isHiddenName(name)) return name;
  const dot = name.indexOf(".");
  const stem = dot < 0 ? name : name.slice(0, dot);
  const rest = dot < 0 ? "" : name.slice(dot);
  return `${toCase(stem, style)}${rest}`;
}

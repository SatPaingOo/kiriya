import { isHiddenName } from "../../../core/domain/names.js";

export const CASE_STYLES = ["kebab", "snake", "camel", "pascal", "lower", "upper"] as const;
export type CaseStyle = (typeof CASE_STYLES)[number];

/** "userProfile_v2 Final" -> ["user", "Profile", "v2", "Final"]; letters of any script count. */
export function splitWords(text: string): string[] {
  return text
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter((word) => word.length > 0);
}

function styleWords(text: string, style: CaseStyle): string {
  if (style === "lower") return text.toLowerCase();
  if (style === "upper") return text.toUpperCase();
  const words = splitWords(text);
  if (words.length === 0) return text;
  const lower = words.map((word) => word.toLowerCase());
  const capital = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
  switch (style) {
    case "kebab":
      return lower.join("-");
    case "snake":
      return lower.join("_");
    case "camel":
      return lower.map((word, index) => (index === 0 ? word : capital(word))).join("");
    case "pascal":
      return lower.map(capital).join("");
  }
}

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
  return `${styleWords(stem, style)}${rest}`;
}

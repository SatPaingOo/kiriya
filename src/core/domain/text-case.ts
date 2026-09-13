export const TEXT_CASES = ["kebab", "snake", "camel", "pascal", "constant", "title", "lower", "upper"] as const;
export type TextCase = (typeof TEXT_CASES)[number];

/** "userProfile_v2 Final" -> ["user", "Profile", "v2", "Final"]; letters of any script count. */
export function splitWords(text: string): string[] {
  return text
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter((word) => word.length > 0);
}

/**
 * Text in another case. Words are found at separators, case changes and digits;
 * `lower` and `upper` keep the text as it is apart from its case.
 */
export function toCase(text: string, style: TextCase): string {
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
    case "constant":
      return lower.join("_").toUpperCase();
    case "camel":
      return lower.map((word, index) => (index === 0 ? word : capital(word))).join("");
    case "pascal":
      return lower.map(capital).join("");
    case "title":
      return lower.map(capital).join(" ");
  }
}

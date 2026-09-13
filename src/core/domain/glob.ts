const GLOB_CHARACTERS = /[*?[{]/;
const REGEX_SPECIAL: ReadonlySet<string> = new Set([".", "+", "^", "$", "(", ")", "|", "\\", "/"]);

export function hasGlob(text: string): boolean {
  return GLOB_CHARACTERS.test(text);
}

/**
 * A glob as a RegExp over `/`-separated relative paths, ignoring case, the same on
 * every OS: `*` and `?` stay within one folder, `**` crosses folders, and `[abc]`,
 * `[!abc]` and `{ts,tsx}` work as in bash.
 */
export function globToRegExp(pattern: string): RegExp {
  let source = "";
  let inBraces = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern.charAt(index);
    if (char === "*") {
      if (pattern.charAt(index + 1) === "*") {
        const slashAfter = pattern.charAt(index + 2) === "/";
        source += slashAfter ? "(?:.*/)?" : ".*";
        index += slashAfter ? 2 : 1;
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (char === "[") {
      const close = pattern.indexOf("]", index + 1);
      if (close < 0) {
        source += "\\[";
      } else {
        const body = pattern.slice(index + 1, close);
        source += `[${body.startsWith("!") ? `^${body.slice(1)}` : body}]`;
        index = close;
      }
    } else if (char === "{") {
      inBraces = true;
      source += "(?:";
    } else if (char === "}" && inBraces) {
      inBraces = false;
      source += ")";
    } else if (char === "," && inBraces) {
      source += "|";
    } else {
      source += REGEX_SPECIAL.has(char) ? `\\${char}` : char;
    }
  }
  return new RegExp(`^${source}$`, "i");
}

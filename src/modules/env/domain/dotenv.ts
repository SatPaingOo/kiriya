export interface DotenvEntry {
  readonly key: string;
  /** Where the entry starts, from 1. */
  readonly line: number;
  readonly empty: boolean;
}

export interface ParsedDotenv {
  readonly entries: readonly DotenvEntry[];
  /** Lines that are neither an entry, a comment nor blank, from 1. */
  readonly malformed: readonly number[];
}

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const ENTRY = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/;
const QUOTES = ['"', "'", "`"];

/** Where the closing quote is from `start`, skipping escaped ones inside double quotes; -1 when there is none. */
function closingQuote(text: string, quote: string, start: number): number {
  for (let index = start; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char === "\\" && quote === '"') {
      index += 1;
    } else if (char === quote) {
      return index;
    }
  }
  return -1;
}

/**
 * The keys of a .env file as dotenv reads it: `KEY=value`, an optional `export`,
 * `#` comments, and values in single, double or backtick quotes that may span lines.
 * A value is only checked for being empty; it never leaves this function.
 */
export function parseDotenv(content: string): ParsedDotenv {
  const text = content.startsWith(BYTE_ORDER_MARK) ? content.slice(1) : content;
  const lines = text.split(/\r?\n/);
  const entries: DotenvEntry[] = [];
  const malformed: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = (lines[index] ?? "").trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const match = ENTRY.exec(trimmed);
    if (match === null) {
      malformed.push(index + 1);
      continue;
    }
    const key = match[1] ?? "";
    const rest = match[2] ?? "";
    const quote = rest.charAt(0);
    if (!QUOTES.includes(quote)) {
      // Unquoted, a # starts a comment.
      entries.push({ key, line: index + 1, empty: (rest.split("#")[0] ?? "").trim() === "" });
      continue;
    }
    const close = closingQuote(rest, quote, 1);
    if (close >= 0) {
      entries.push({ key, line: index + 1, empty: close === 1 });
      continue;
    }
    // The value goes on to the line with the closing quote.
    let end = index + 1;
    while (end < lines.length && closingQuote(lines[end] ?? "", quote, 0) < 0) end += 1;
    if (end === lines.length) {
      malformed.push(index + 1);
      continue;
    }
    entries.push({ key, line: index + 1, empty: false });
    index = end;
  }
  return { entries, malformed };
}

export interface JsonProblem {
  /** UTF-16 offset of the first character that cannot be part of valid JSON. */
  readonly offset: number;
  /** From 1. */
  readonly line: number;
  readonly column: number;
}

class Stop {
  constructor(readonly offset: number) {}
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/**
 * Where JSON text first breaks the grammar, or null when it is valid. JSON.parse's
 * messages differ between Node.js versions and often give no position, so kiriya
 * finds the place itself and every version reports the same line and column.
 */
export function findJsonProblem(text: string): JsonProblem | null {
  try {
    scan(text);
    return null;
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    const offset = Math.min(error.offset, text.length);
    const before = text.slice(0, offset);
    const lineStart = before.lastIndexOf("\n") + 1;
    return { offset, line: before.split("\n").length, column: offset - lineStart + 1 };
  }
}

/** Throws Stop at the first character that breaks the grammar. Keeps its own stack, so deep nesting cannot overflow. */
function scan(text: string): void {
  let at = 0;
  const fail = (): never => {
    throw new Stop(at);
  };
  const skipSpace = (): void => {
    while (at < text.length && " \t\n\r".includes(text.charAt(at))) at += 1;
  };
  const expect = (char: string): void => {
    if (text.charAt(at) !== char) fail();
    at += 1;
  };
  const string = (): void => {
    at += 1;
    while (at < text.length) {
      const code = text.charCodeAt(at);
      if (code === 0x22) {
        at += 1;
        return;
      }
      if (code < 0x20) fail();
      if (code !== 0x5c) {
        at += 1;
        continue;
      }
      const escaped = text.charAt(at + 1);
      if (escaped !== "" && '"\\/bfnrt'.includes(escaped)) {
        at += 2;
      } else if (escaped === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(at + 2, at + 6))) {
        at += 6;
      } else {
        at += 1;
        fail();
      }
    }
    fail();
  };
  const key = (): void => {
    skipSpace();
    if (text.charAt(at) !== '"') fail();
    string();
    skipSpace();
    expect(":");
  };
  const scalar = (): void => {
    if (text.charAt(at) === '"') {
      string();
      return;
    }
    for (const word of ["true", "false", "null"]) {
      if (text.startsWith(word, at)) {
        at += word.length;
        return;
      }
    }
    NUMBER.lastIndex = at;
    if (!NUMBER.test(text)) fail();
    at = NUMBER.lastIndex;
  };

  /** The closing characters of the arrays and objects the scan is inside. */
  const open: string[] = [];
  for (;;) {
    // A value starts here.
    skipSpace();
    const char = text.charAt(at);
    if (char === "{" || char === "[") {
      const close = char === "{" ? "}" : "]";
      at += 1;
      skipSpace();
      if (text.charAt(at) !== close) {
        open.push(close);
        if (close === "}") key();
        continue;
      }
      at += 1;
    } else {
      scalar();
    }
    // A value ended: a comma leads to the next one, or the arrays and objects around it close.
    for (;;) {
      skipSpace();
      const close = open.at(-1);
      if (close === undefined) {
        if (at !== text.length) fail();
        return;
      }
      if (text.charAt(at) === ",") {
        at += 1;
        if (close === "}") key();
        break;
      }
      expect(close);
      open.pop();
    }
  }
}

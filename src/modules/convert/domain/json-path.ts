/**
 * A miss names the part of the path that was not there, rather than only saying no: given
 * `data.pid` against a body with no `data`, the answer is `data`, which is the fixable fact.
 */
export type JsonLookup =
  { readonly found: true; readonly value: unknown } | { readonly found: false; readonly at: string };

/**
 * Whether a path names anything at all: `pid`, `data.entries.0.name`, and a leading dot as jq
 * writes it. A key that itself contains a dot cannot be reached, which is the price of a
 * path with no quoting language in it, and the guide says so plainly.
 */
export function isJsonPath(path: string): boolean {
  return segmentsOf(path) !== null;
}

/** The value a path leads to, walking objects by key and arrays by index. */
export function lookupJsonPath(root: unknown, path: string): JsonLookup {
  const segments = segmentsOf(path);
  if (segments === null) return { found: false, at: path };
  let value = root;
  for (const [index, segment] of segments.entries()) {
    const next = step(value, segment);
    if (next === undefined) return { found: false, at: segments.slice(0, index + 1).join(".") };
    value = next;
  }
  return { found: true, value };
}

function segmentsOf(path: string): readonly string[] | null {
  // Typing the leading dot is a jq habit, and accepting it costs nothing.
  const written = path.startsWith(".") ? path.slice(1) : path;
  if (written === "") return null;
  const segments = written.split(".");
  return segments.every((segment) => segment !== "") ? segments : null;
}

/** An index and nothing else, so `length` and an array's other members stay out of reach. */
const INDEX = /^(?:0|[1-9]\d*)$/;

/**
 * What one segment leads to, or undefined for nothing. undefined is unambiguous here because
 * JSON cannot hold it: a key with no value and a hole in an array are both invalid JSON, so
 * `JSON.parse` never produces one.
 */
function step(value: unknown, segment: string): unknown {
  if (Array.isArray(value)) return INDEX.test(segment) ? value[Number(segment)] : undefined;
  if (typeof value !== "object" || value === null) return undefined;
  // Own keys only: `__proto__`, `constructor` and `toString` name JavaScript, never JSON.
  return Object.hasOwn(value, segment) ? (value as Record<string, unknown>)[segment] : undefined;
}

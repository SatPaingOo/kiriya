/** "v24.14.0" or "22.13" -> [24, 14, 0] or [22, 13]; a part that is not a number counts as 0. */
export function versionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isNaN(part) ? 0 : part));
}

/** Compares part by part; a missing part counts as 0, so 22.13 equals 22.13.0. */
export function isAtLeast(version: string, minimum: string): boolean {
  const actual = versionParts(version);
  const required = versionParts(minimum);
  for (let index = 0; index < Math.max(actual.length, required.length); index += 1) {
    const a = actual[index] ?? 0;
    const b = required[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

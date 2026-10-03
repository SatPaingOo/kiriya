/**
 * A line may say that the secret on it is deliberate, which test fixtures and documentation
 * need: a scanner whose first run on its own repository is all false positives gets turned
 * off and never run again. The marker sits next to what it excuses and shows up in review,
 * which an ignore file in a corner does not.
 */
const MARKER = /kiriya:allow-secret/;

/**
 * Whether the secret on this line was declared deliberate: by a marker on the line, or on
 * either neighbour.
 *
 * The line below counts because a formatter moves trailing comments. Prettier, which this
 * repository runs, reflowed `for (… "-----BEGIN RSA PRIVATE KEY-----"]) { // kiriya:allow-secret`
 * onto the next line and silently unmarked the fixture. A marker a formatter can move is no
 * marker, so both neighbours count.
 */
export function isAllowed(lines: readonly string[], index: number): boolean {
  return [index - 1, index, index + 1].some((at) => {
    const line = lines[at];
    return line !== undefined && MARKER.test(line);
  });
}

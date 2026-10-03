/** Comparing two released versions, and reading the newest one out of what a registry answers. */

export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** The text after a hyphen, such as `rc.1`; null for a plain release. */
  readonly prerelease: string | null;
}

const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(text: string): Version | null {
  const match = PATTERN.exec(text.trim());
  if (match === null) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ?? null,
  };
}

/**
 * Negative when `a` is older, positive when newer, zero when the same. A prerelease is older
 * than the release it leads to, which is all kiriya needs: it never offers one as an upgrade.
 */
export function compareVersions(a: Version, b: Version): number {
  for (const part of ["major", "minor", "patch"] as const) {
    if (a[part] !== b[part]) return a[part] - b[part];
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

/**
 * The version the registry calls `latest`, from the body of
 * `https://registry.npmjs.org/<name>/latest`. null when the body is not what that endpoint
 * answers, so a proxy returning a login page is a failure rather than a version.
 */
export function readLatestVersion(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== "string") return null;
  return parseVersion(version) === null ? null : version;
}

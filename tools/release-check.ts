/** What must hold before the release workflow publishes a version. */

export interface ReleaseFacts {
  /** The Git tag of the GitHub release, such as v0.1.0. */
  readonly tag: string | undefined;
  readonly version: string;
  readonly isPrivate: boolean;
  readonly changelog: string;
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Problems that stop a release, one sentence each; none when it may be published. */
export function releaseProblems(facts: ReleaseFacts): string[] {
  const { tag, version } = facts;
  const problems: string[] = [];
  if (!SEMVER.test(version) || version === "0.0.0") problems.push(`${version} is not a version to release`);
  if (tag !== `v${version}`)
    problems.push(`the tag ${tag ?? "(none)"} is not v${version}, the version in package.json`);
  if (facts.isPrivate) problems.push('package.json still says "private": true');
  const section = new RegExp(`^## \\[${escapeRegExp(version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m");
  if (!section.test(facts.changelog)) problems.push(`CHANGELOG.md has no "## [${version}] - YYYY-MM-DD" section`);
  return problems;
}

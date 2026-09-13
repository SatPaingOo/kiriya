import { byCodePoint } from "../../../core/domain/names.js";

export const DEFAULT_DEPTH = 3;
export const MAX_DEPTH = 10;

export interface RepositoryStatus {
  /** Relative to the folder given, with `/`; the folder's own name when it is the repository. */
  readonly name: string;
  readonly path: string;
  /** The branch, a short commit id for a detached HEAD, or `?`. */
  readonly branch: string;
  readonly commits: number;
  /** Files with uncommitted changes, as `git status` counts them. */
  readonly dirty: number;
  /** null when the branch has no upstream. */
  readonly ahead: number | null;
  readonly behind: number | null;
  readonly hasRemote: boolean;
}

export type SyncState =
  | { readonly kind: "no-upstream" }
  | { readonly kind: "in-sync" }
  | { readonly kind: "diverged"; readonly ahead: number; readonly behind: number };

export function syncState(status: Pick<RepositoryStatus, "ahead" | "behind">): SyncState {
  if (status.ahead === null || status.behind === null) return { kind: "no-upstream" };
  if (status.ahead === 0 && status.behind === 0) return { kind: "in-sync" };
  return { kind: "diverged", ahead: status.ahead, behind: status.behind };
}

/** `git rev-list --left-right --count @{upstream}...HEAD` prints the commits behind, then the commits ahead. */
export function parseLeftRight(text: string | null): { readonly behind: number; readonly ahead: number } | null {
  const match = /^(\d+)\s+(\d+)$/.exec(text?.trim() ?? "");
  return match === null ? null : { behind: Number(match[1]), ahead: Number(match[2]) };
}

/** The branch most repositories are on, when they are not all on one; ties go to the first in code-point order. */
export function majorityBranch(branches: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const branch of branches) counts.set(branch, (counts.get(branch) ?? 0) + 1);
  if (counts.size < 2) return null;
  let best: readonly [string, number] | null = null;
  for (const entry of [...counts.entries()].sort(([a], [b]) => byCodePoint(a, b))) {
    if (best === null || entry[1] > best[1]) best = entry;
  }
  return best === null ? null : best[0];
}

/** The first line with text in a program's output, trimmed. */
export function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "") ?? ""
  );
}

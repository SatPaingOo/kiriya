import path from "node:path";
import { CapabilityUnavailableError } from "../../../core/domain/errors.js";
import type { ProcessResult, ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { parseLeftRight, type RepositoryStatus } from "../domain/repository-status.js";

/** Git never stops to ask for a password in the middle of a run over many repositories. */
const NON_INTERACTIVE: Readonly<Record<string, string>> = { GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };

/** Fetch and pull talk to remotes, which may be slow. */
export const NETWORK_TIMEOUT_MS = 180_000;

/** Git run in one repository at a time, without a shell and without prompts. */
export class GitClient {
  private constructor(
    private readonly runner: ProcessRunner,
    private readonly git: string,
    private readonly signal: AbortSignal,
  ) {}

  static async locate(runner: ProcessRunner, signal: AbortSignal): Promise<GitClient> {
    const git = await runner.find("git");
    if (git === null) throw new CapabilityUnavailableError("git.not-installed");
    return new GitClient(runner, git, signal);
  }

  run(repository: string, args: readonly string[], timeoutMs = 60_000): Promise<ProcessResult> {
    return this.runner.run(this.git, ["-C", repository, ...args], {
      env: NON_INTERACTIVE,
      timeoutMs,
      signal: this.signal,
    });
  }

  /** stdout without trailing whitespace, or null when git fails. */
  async output(repository: string, args: readonly string[]): Promise<string | null> {
    const result = await this.run(repository, args);
    return result.code === 0 ? result.stdout.replace(/\s+$/, "") : null;
  }

  async succeeds(repository: string, args: readonly string[]): Promise<boolean> {
    return (await this.run(repository, args)).code === 0;
  }

  async lines(repository: string, args: readonly string[]): Promise<string[]> {
    const text = await this.output(repository, args);
    return text === null ? [] : text.split(/\r?\n/).filter((line) => line !== "");
  }

  async status(folder: string, repository: string): Promise<RepositoryStatus> {
    // symbolic-ref works on a branch with no commits yet; rev-parse covers a detached HEAD.
    const branch =
      (await this.output(repository, ["symbolic-ref", "--short", "HEAD"])) ??
      (await this.output(repository, ["rev-parse", "--short", "HEAD"])) ??
      "?";
    const counts = parseLeftRight(
      await this.output(repository, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]),
    );
    const relative = path.relative(folder, repository).split(path.sep).join("/");
    return {
      name: relative === "" ? path.basename(repository) : relative,
      path: repository,
      branch,
      commits: Number((await this.output(repository, ["rev-list", "--count", "HEAD"])) ?? 0),
      dirty: (await this.lines(repository, ["status", "--porcelain"])).length,
      ahead: counts?.ahead ?? null,
      behind: counts?.behind ?? null,
      hasRemote: (await this.lines(repository, ["remote"])).length > 0,
    };
  }
}

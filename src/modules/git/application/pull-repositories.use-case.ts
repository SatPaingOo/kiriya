import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { firstLine, type RepositoryStatus } from "../domain/repository-status.js";
import { GitClient, NETWORK_TIMEOUT_MS } from "./git-client.js";
import { folderInput, repositoriesIn, type FolderInput } from "./repositories.js";

export type PullOutcome = "pulled" | "up-to-date" | "no-remote" | "no-upstream" | "dirty" | "failed";

export interface PullItem {
  readonly status: RepositoryStatus;
  readonly outcome: PullOutcome;
  readonly newCommits: number;
}

export interface PullOutput {
  readonly folder: string;
  readonly items: readonly PullItem[];
}

export const pullSpec: CommandSpec<FolderInput> = {
  id: "git.pull",
  summary: "git.pull.summary",
  examples: ["kiriya git pull", "kiriya git pull ~/work --json"],
  safety: "write",
  idempotent: true,
  usesNetwork: true,
  runsUserCommands: false,
  input: folderInput,
};

/** Fast-forward only: a repository with uncommitted changes, no upstream, or diverged history is left as it is. */
export class PullRepositories implements Command<FolderInput, PullOutput> {
  readonly spec = pullSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: FolderInput, context: CommandContext): Promise<CommandResult<PullOutput>> {
    const git = await GitClient.locate(this.processRunner, context.signal);
    const { folder, repositories } = await repositoriesIn(this.fileSystem, context.cwd, input);
    const items: PullItem[] = [];
    const warnings: Message[] = repositories.length === 0 ? [message("git.none-found", { depth: input.depth })] : [];
    const failures: Message[] = [];
    for (const repository of repositories) {
      if (context.signal.aborted) break;
      const status = await git.status(folder, repository);
      const skip = (outcome: PullOutcome): void => void items.push({ status, outcome, newCommits: 0 });
      if (!status.hasRemote) {
        skip("no-remote");
        continue;
      }
      if (status.ahead === null) {
        skip("no-upstream");
        continue;
      }
      if (status.dirty > 0) {
        warnings.push(message("git.pull.dirty", { name: status.name, count: status.dirty }));
        skip("dirty");
        continue;
      }
      const before = await git.output(repository, ["rev-parse", "HEAD"]);
      const result = await git.run(repository, ["pull", "--ff-only", "--quiet"], NETWORK_TIMEOUT_MS);
      if (result.code !== 0) {
        const detail = firstLine(result.stderr) || firstLine(result.stdout);
        failures.push(message("git.pull.failed", { name: status.name, detail }));
        skip("failed");
        continue;
      }
      const after = await git.output(repository, ["rev-parse", "HEAD"]);
      const moved = before !== null && after !== null && before !== after;
      const count = moved
        ? Number((await git.output(repository, ["rev-list", "--count", `${before}..${after}`])) ?? 0)
        : 0;
      items.push({ status, outcome: count > 0 ? "pulled" : "up-to-date", newCommits: count });
    }
    return done({ folder, items }, { warnings, failures });
  }
}

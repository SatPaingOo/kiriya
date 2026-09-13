import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { majorityBranch, type RepositoryStatus } from "../domain/repository-status.js";
import { GitClient } from "./git-client.js";
import { folderInput, repositoriesIn, type FolderInput } from "./repositories.js";

export interface StatusOutput {
  readonly folder: string;
  /** The folder is one repository, not a workspace holding several. */
  readonly isRepository: boolean;
  readonly repositories: readonly RepositoryStatus[];
  /** Every repository has a remote, nothing is unpushed, and all are on one branch. */
  readonly allGood: boolean;
}

export const statusSpec: CommandSpec<FolderInput> = {
  id: "git.status",
  summary: "git.status.summary",
  examples: ["kiriya git status", "kiriya git status ~/work --depth 2", "kiriya git status --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: folderInput,
};

export class ShowStatus implements Command<FolderInput, StatusOutput> {
  readonly spec = statusSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: FolderInput, context: CommandContext): Promise<CommandResult<StatusOutput>> {
    const git = await GitClient.locate(this.processRunner, context.signal);
    const { folder, repositories } = await repositoriesIn(this.fileSystem, context.cwd, input);
    const statuses: RepositoryStatus[] = [];
    for (const repository of repositories) statuses.push(await git.status(folder, repository));

    const isRepository = repositories.length === 1 && repositories[0] === folder;
    const failures = statuses
      .filter((status) => !status.hasRemote)
      .map((status) => message("git.status.no-remote", { name: status.name }));
    const warnings: Message[] = statuses
      .filter((status) => (status.ahead ?? 0) > 0)
      .map((status) => message("git.status.unpushed", { name: status.name, count: status.ahead ?? 0 }));
    const common = isRepository ? null : majorityBranch(statuses.map((status) => status.branch));
    if (common !== null) {
      for (const status of statuses.filter((item) => item.branch !== common)) {
        warnings.push(message("git.status.other-branch", { name: status.name, branch: status.branch, common }));
      }
    }
    if (statuses.length === 0) warnings.push(message("git.none-found", { depth: input.depth }));

    const allGood = statuses.length > 0 && failures.length === 0 && warnings.length === 0;
    return done({ folder, isRepository, repositories: statuses, allGood }, { warnings, failures });
  }
}

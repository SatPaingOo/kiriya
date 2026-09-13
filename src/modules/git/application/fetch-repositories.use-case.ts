import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { firstLine, type RepositoryStatus } from "../domain/repository-status.js";
import { GitClient, NETWORK_TIMEOUT_MS } from "./git-client.js";
import { folderInput, repositoriesIn, type FolderInput } from "./repositories.js";

export interface FetchItem {
  /** After the fetch when it succeeded, before it otherwise. */
  readonly status: RepositoryStatus;
  readonly outcome: "fetched" | "no-remote" | "failed";
}

export interface FetchOutput {
  readonly folder: string;
  readonly items: readonly FetchItem[];
}

export const fetchSpec: CommandSpec<FolderInput> = {
  id: "git.fetch",
  summary: "git.fetch.summary",
  examples: ["kiriya git fetch", "kiriya git fetch ~/work --depth 2"],
  safety: "write",
  idempotent: true,
  usesNetwork: true,
  runsUserCommands: false,
  input: folderInput,
};

export class FetchRepositories implements Command<FolderInput, FetchOutput> {
  readonly spec = fetchSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: FolderInput, context: CommandContext): Promise<CommandResult<FetchOutput>> {
    const git = await GitClient.locate(this.processRunner, context.signal);
    const { folder, repositories } = await repositoriesIn(this.fileSystem, context.cwd, input);
    const items: FetchItem[] = [];
    const warnings: Message[] = repositories.length === 0 ? [message("git.none-found", { depth: input.depth })] : [];
    const failures: Message[] = [];
    for (const repository of repositories) {
      if (context.signal.aborted) break;
      const before = await git.status(folder, repository);
      if (!before.hasRemote) {
        items.push({ status: before, outcome: "no-remote" });
        continue;
      }
      const result = await git.run(repository, ["fetch", "--all", "--prune", "--quiet"], NETWORK_TIMEOUT_MS);
      if (result.code !== 0) {
        const detail = firstLine(result.stderr) || firstLine(result.stdout);
        failures.push(message("git.fetch.failed", { name: before.name, detail }));
        items.push({ status: before, outcome: "failed" });
        continue;
      }
      items.push({ status: await git.status(folder, repository), outcome: "fetched" });
    }
    return done({ folder, items }, { warnings, failures });
  }
}

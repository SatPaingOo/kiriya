import { requireApproval } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { firstLine } from "../domain/repository-status.js";
import { GitClient } from "./git-client.js";
import { readDepth, repositoriesIn } from "./repositories.js";

/** already: on it. local: the branch exists. track: only on origin. create: --create makes it. missing: nowhere. */
export type SwitchAction = "already" | "local" | "track" | "create" | "missing";

export interface SwitchInput {
  readonly branch: string;
  readonly folder: string;
  readonly depth: number;
  readonly create: boolean;
  readonly yes: boolean;
}

export interface SwitchStep {
  readonly name: string;
  readonly path: string;
  readonly from: string;
  readonly dirty: number;
  readonly action: SwitchAction;
  readonly outcome: "planned" | "unchanged" | "switched" | "failed";
}

export interface SwitchOutput {
  readonly branch: string;
  readonly folder: string;
  readonly steps: readonly SwitchStep[];
}

function gitArgs(action: SwitchAction, branch: string): string[] {
  if (action === "local") return ["switch", branch];
  if (action === "track") return ["switch", "-c", branch, "--track", `origin/${branch}`];
  return ["switch", "-c", branch];
}

export const switchSpec: CommandSpec<SwitchInput> = {
  id: "git.switch",
  summary: "git.switch.summary",
  examples: [
    "kiriya git switch main",
    "kiriya git switch feature/login ~/work --create",
    "kiriya git switch develop --yes",
  ],
  safety: "write",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [
      { name: "branch", description: "git.switch.arg.branch", required: true, variadic: false },
      { name: "folder", description: "git.arg.folder", required: false, variadic: false, path: true },
    ],
    options: {
      create: { type: "boolean", description: "git.switch.option.create" },
      depth: { type: "string", description: "git.option.depth", valueName: "<1-10>" },
      yes: { type: "boolean", description: "git.switch.option.yes", short: "y", terminalOnly: true },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return {
        branch: reader.positional(0) ?? "",
        folder: reader.positional(1) ?? ".",
        depth: readDepth(reader),
        create: reader.flag("create"),
        yes: reader.flag("yes"),
      };
    },
  },
};

/** Every repository under a folder onto one branch, or none of them when any is not ready. */
export class SwitchBranch implements Command<SwitchInput, SwitchOutput> {
  readonly spec = switchSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: SwitchInput, context: CommandContext): Promise<CommandResult<SwitchOutput>> {
    const git = await GitClient.locate(this.processRunner, context.signal);
    const { folder, repositories } = await repositoriesIn(this.fileSystem, context.cwd, input);
    if (!(await git.succeeds(folder, ["check-ref-format", "--branch", input.branch]))) {
      throw new UsageError("git.switch.bad-branch", { branch: input.branch });
    }

    const steps: SwitchStep[] = [];
    for (const repository of repositories) {
      const status = await git.status(folder, repository);
      let action: SwitchAction;
      if (status.branch === input.branch) action = "already";
      else if (await git.succeeds(repository, ["rev-parse", "--verify", "--quiet", `refs/heads/${input.branch}`])) {
        action = "local";
      } else if (
        await git.succeeds(repository, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${input.branch}`])
      ) {
        action = "track";
      } else action = input.create ? "create" : "missing";
      const outcome = action === "already" ? "unchanged" : "planned";
      steps.push({ name: status.name, path: repository, from: status.branch, dirty: status.dirty, action, outcome });
    }

    const data: SwitchOutput = { branch: input.branch, folder, steps };
    const warnings = repositories.length === 0 ? [message("git.none-found", { depth: input.depth })] : [];
    const problems: Message[] = [
      ...steps
        .filter((step) => step.action !== "already" && step.dirty > 0)
        .map((step) => message("git.switch.dirty", { name: step.name, count: step.dirty })),
      ...steps
        .filter((step) => step.action === "missing")
        .map((step) => message("git.switch.missing", { name: step.name, branch: input.branch })),
    ];
    if (problems.length > 0) return done(data, { warnings, failures: problems });
    const pending = steps.filter((step) => step.action !== "already");
    if (pending.length === 0) return done(data, { warnings });

    await requireApproval(
      context,
      message("git.switch.ask", { count: pending.length, branch: input.branch }),
      input.yes,
    );
    const failures: Message[] = [];
    const finished = [];
    for (const step of steps) {
      if (step.action === "already") {
        finished.push(step);
        continue;
      }
      const result = await git.run(step.path, gitArgs(step.action, input.branch));
      if (result.code === 0) {
        finished.push({ ...step, outcome: "switched" as const });
      } else {
        const detail = firstLine(result.stderr) || firstLine(result.stdout);
        failures.push(message("git.switch.failed", { name: step.name, detail }));
        finished.push({ ...step, outcome: "failed" as const });
      }
    }
    return done({ ...data, steps: finished }, { warnings, failures });
  }
}

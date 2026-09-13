import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { NotFoundError, OperationFailedError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { parseContainers, parseProjects, type ComposeProjectState, type Container } from "../domain/engine-output.js";
import { composeArgs, fileOption, findComposeProject, type ComposeProject } from "./compose-project.js";
import { DockerEngine } from "./docker-engine.js";

export interface PsInput {
  readonly file: string | undefined;
  readonly projects: boolean;
}

export type PsOutput =
  | {
      readonly mode: "project";
      readonly project: string;
      readonly file: string;
      readonly containers: readonly Container[];
    }
  | { readonly mode: "projects"; readonly projects: readonly ComposeProjectState[] };

export const psSpec: CommandSpec<PsInput> = {
  id: "docker.ps",
  summary: "docker.ps.summary",
  examples: ["kiriya docker ps", "kiriya docker ps --projects", "kiriya docker ps --file deploy/compose.yaml --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: { file: fileOption, projects: { type: "boolean", description: "docker.ps.option.projects" } },
    parse(raw) {
      const reader = new RawReader(raw);
      return { file: reader.string("file"), projects: reader.flag("projects") };
    },
  },
};

/** The containers of the project here; every compose project with --projects, or when there is no project here. */
export class ListContainers implements Command<PsInput, PsOutput> {
  readonly spec = psSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: PsInput, context: CommandContext): Promise<CommandResult<PsOutput>> {
    const project = input.projects ? null : await this.projectHere(input, context.cwd);
    const engine = await DockerEngine.connect(this.processRunner, context.signal);
    if (project === null) {
      const listed = await engine.capture(["compose", "ls", "--all", "--format", "json"]);
      if (listed.code !== 0)
        throw new OperationFailedError("docker.command-failed", {
          command: "compose ls",
          detail: listed.stderr.trim(),
        });
      return done({ mode: "projects", projects: parseProjects(listed.stdout) });
    }
    const listed = await engine.capture(composeArgs(project, ["ps", "--all", "--format", "json"]));
    if (listed.code !== 0)
      throw new OperationFailedError("docker.command-failed", { command: "compose ps", detail: listed.stderr.trim() });
    return done({
      mode: "project",
      project: project.name,
      file: project.file,
      containers: parseContainers(listed.stdout),
    });
  }

  private async projectHere(input: PsInput, cwd: string): Promise<ComposeProject | null> {
    try {
      return await findComposeProject(this.fileSystem, this.content, cwd, input.file);
    } catch (error) {
      if (input.file === undefined && error instanceof NotFoundError && error.detail.key === "docker.no-compose-file") {
        return null;
      }
      throw error;
    }
  }
}

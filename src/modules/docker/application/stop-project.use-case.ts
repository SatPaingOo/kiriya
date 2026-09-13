import { requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { composeArgs, fileOption, findComposeProject } from "./compose-project.js";
import { DockerEngine } from "./docker-engine.js";

export interface DownInput {
  readonly file: string | undefined;
  readonly volumes: boolean;
  readonly confirm: string | undefined;
}

export interface DownOutput {
  readonly project: string;
  readonly volumes: boolean;
  readonly succeeded: boolean;
}

export const downSpec: CommandSpec<DownInput> = {
  id: "docker.down",
  summary: "docker.down.summary",
  examples: ["kiriya docker down", "kiriya docker down --volumes", "kiriya docker down --volumes --confirm=my-project"],
  safety: "destroy",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: {
      file: fileOption,
      volumes: { type: "boolean", description: "docker.down.option.volumes" },
      confirm: {
        type: "string",
        description: "docker.down.option.confirm",
        valueName: "<project>",
        terminalOnly: true,
      },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { file: reader.string("file"), volumes: reader.flag("volumes"), confirm: reader.string("confirm") };
    },
  },
};

export class StopProject implements Command<DownInput, DownOutput> {
  readonly spec = downSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: DownInput, context: CommandContext): Promise<CommandResult<DownOutput>> {
    const project = await findComposeProject(this.fileSystem, this.content, context.cwd, input.file);
    const engine = await DockerEngine.connect(this.processRunner, context.signal);
    if (input.volumes) {
      const warning = message("docker.down.warn-volumes", { project: project.name });
      await requireTypedConfirmation(context, warning, project.name, input.confirm);
    }
    const args = composeArgs(project, ["down", ...(input.volumes ? ["--volumes"] : [])]);
    const code = await engine.stream(args, context.passthrough);
    const failures = code === 0 ? [] : [message("docker.down.failed", { project: project.name, code })];
    return done({ project: project.name, volumes: input.volumes, succeeded: code === 0 }, { failures });
  }
}

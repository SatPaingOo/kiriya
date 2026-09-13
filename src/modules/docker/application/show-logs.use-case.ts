import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { composeArgs, fileOption, findComposeProject, servicesPositional } from "./compose-project.js";
import { DockerEngine } from "./docker-engine.js";

export interface LogsInput {
  readonly services: readonly string[];
  readonly file: string | undefined;
  readonly follow: boolean;
  /** A number of lines, or `all`. */
  readonly tail: string;
}

export interface LogsOutput {
  readonly project: string;
  readonly succeeded: boolean;
}

export const logsSpec: CommandSpec<LogsInput> = {
  id: "docker.logs",
  summary: "docker.logs.summary",
  examples: ["kiriya docker logs", "kiriya docker logs api -f", "kiriya docker logs db --tail all"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [servicesPositional],
    options: {
      file: fileOption,
      follow: { type: "boolean", description: "docker.logs.option.follow", short: "f" },
      tail: { type: "string", description: "docker.logs.option.tail", valueName: "<n|all>" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const tail = reader.string("tail") ?? "200";
      if (tail !== "all" && !/^[0-9]+$/.test(tail)) throw new UsageError("docker.logs.tail-invalid", { value: tail });
      return { services: reader.positionalsFrom(0), file: reader.string("file"), follow: reader.flag("follow"), tail };
    },
  },
};

/** The logs arrive through the passthrough as docker prints them; --follow runs until Ctrl+C. */
export class ShowLogs implements Command<LogsInput, LogsOutput> {
  readonly spec = logsSpec;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: LogsInput, context: CommandContext): Promise<CommandResult<LogsOutput>> {
    const project = await findComposeProject(this.fileSystem, this.content, context.cwd, input.file);
    const engine = await DockerEngine.connect(this.processRunner, context.signal);
    const args = ["logs", "--tail", input.tail, ...(input.follow ? ["--follow"] : []), ...input.services];
    const code = await engine.stream(composeArgs(project, args), context.passthrough);
    const failures = code === 0 ? [] : [message("docker.logs.failed", { project: project.name, code })];
    return done({ project: project.name, succeeded: code === 0 }, { failures });
  }
}

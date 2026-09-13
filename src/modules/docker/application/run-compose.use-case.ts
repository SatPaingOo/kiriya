import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import { portMappings, type PortMapping } from "../domain/compose-file.js";
import { composeArgs, fileOption, findComposeProject, servicesPositional } from "./compose-project.js";
import { DockerEngine } from "./docker-engine.js";

export interface StartInput {
  readonly services: readonly string[];
  readonly file: string | undefined;
  readonly build: boolean;
}

export interface StartOutput {
  readonly project: string;
  readonly file: string;
  readonly services: readonly string[];
  readonly succeeded: boolean;
  /** Ports the compose file publishes, for the services started. */
  readonly ports: readonly PortMapping[];
}

interface StartVariant {
  readonly args: (input: StartInput) => string[];
  readonly failed: MessageKey;
}

/** `up` and `rebuild` differ only in the compose arguments and their messages. */
class StartProject implements Command<StartInput, StartOutput> {
  constructor(
    readonly spec: CommandSpec<StartInput>,
    private readonly variant: StartVariant,
    private readonly fileSystem: FileSystem,
    private readonly content: FileContent,
    private readonly processRunner: ProcessRunner,
  ) {}

  async execute(input: StartInput, context: CommandContext): Promise<CommandResult<StartOutput>> {
    const project = await findComposeProject(this.fileSystem, this.content, context.cwd, input.file);
    const engine = await DockerEngine.connect(this.processRunner, context.signal);
    const code = await engine.stream(composeArgs(project, this.variant.args(input)), context.passthrough);
    const started = project.services.filter(
      (service) => input.services.length === 0 || input.services.includes(service.name),
    );
    const output: StartOutput = {
      project: project.name,
      file: project.file,
      services: input.services,
      succeeded: code === 0,
      ports: code === 0 ? portMappings(started) : [],
    };
    const failures = code === 0 ? [] : [message(this.variant.failed, { project: project.name, code })];
    return done(output, { failures });
  }
}

/** Starting a compose project runs whatever programs its compose file names, so it is never an MCP tool. */
const COMPOSE_START = { idempotent: true, usesNetwork: false, runsUserCommands: true } as const;

export const upSpec: CommandSpec<StartInput> = {
  id: "docker.up",
  summary: "docker.up.summary",
  examples: ["kiriya docker up", "kiriya docker up api db --build", "kiriya docker up --file deploy/compose.yaml"],
  safety: "write",
  ...COMPOSE_START,
  input: {
    positionals: [servicesPositional],
    options: { file: fileOption, build: { type: "boolean", description: "docker.up.option.build" } },
    parse(raw) {
      const reader = new RawReader(raw);
      return { services: reader.positionalsFrom(0), file: reader.string("file"), build: reader.flag("build") };
    },
  },
};

export const rebuildSpec: CommandSpec<StartInput> = {
  id: "docker.rebuild",
  summary: "docker.rebuild.summary",
  examples: ["kiriya docker rebuild", "kiriya docker rebuild api"],
  safety: "write",
  ...COMPOSE_START,
  input: {
    positionals: [servicesPositional],
    options: { file: fileOption },
    parse(raw) {
      const reader = new RawReader(raw);
      return { services: reader.positionalsFrom(0), file: reader.string("file"), build: true };
    },
  },
};

export function createUp(fileSystem: FileSystem, content: FileContent, runner: ProcessRunner): StartProject {
  const variant: StartVariant = {
    args: (input) => ["up", "--detach", ...(input.build ? ["--build"] : []), ...input.services],
    failed: "docker.up.failed",
  };
  return new StartProject(upSpec, variant, fileSystem, content, runner);
}

export function createRebuild(fileSystem: FileSystem, content: FileContent, runner: ProcessRunner): StartProject {
  const variant: StartVariant = {
    args: (input) => ["up", "--detach", "--build", "--force-recreate", ...input.services],
    failed: "docker.rebuild.failed",
  };
  return new StartProject(rebuildSpec, variant, fileSystem, content, runner);
}

import { requireTypedConfirmation } from "../../../core/application/safety.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done, preview } from "../../../core/domain/command.js";
import { OperationFailedError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { parseDiskUsage, reclaimedSpace, type DiskUsage } from "../domain/engine-output.js";
import { DockerEngine } from "./docker-engine.js";

/** The word a script passes as --confirm, since there is no single count to type. */
export const CLEAN_CONFIRMATION = "prune";
const PRUNE_TIMEOUT_MS = 10 * 60_000;

export interface CleanInput {
  readonly volumes: boolean;
  readonly apply: boolean;
  readonly confirm: string | undefined;
}

export interface PruneResult {
  /** container, image, network, builder or volume. */
  readonly target: string;
  readonly succeeded: boolean;
  readonly reclaimed: string | null;
}

export interface CleanOutput {
  readonly usage: readonly DiskUsage[];
  readonly volumes: boolean;
  readonly results: readonly PruneResult[];
}

export const cleanSpec: CommandSpec<CleanInput> = {
  id: "docker.clean",
  summary: "docker.clean.summary",
  examples: [
    "kiriya docker clean",
    "kiriya docker clean --apply",
    "kiriya docker clean --volumes --apply --confirm=prune",
  ],
  safety: "destroy",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: {
      volumes: { type: "boolean", description: "docker.clean.option.volumes" },
      apply: { type: "boolean", description: "docker.clean.option.apply" },
      confirm: {
        type: "string",
        description: "docker.clean.option.confirm",
        valueName: CLEAN_CONFIRMATION,
        terminalOnly: true,
      },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { volumes: reader.flag("volumes"), apply: reader.flag("apply"), confirm: reader.string("confirm") };
    },
  },
};

/**
 * Stopped containers, dangling images, unused networks and the build cache; unused
 * anonymous volumes only with --volumes. Named volumes and images in use are never pruned.
 */
export class CleanEngine implements Command<CleanInput, CleanOutput> {
  readonly spec = cleanSpec;

  constructor(private readonly processRunner: ProcessRunner) {}

  async execute(input: CleanInput, context: CommandContext): Promise<CommandResult<CleanOutput>> {
    const engine = await DockerEngine.connect(this.processRunner, context.signal);
    const df = await engine.capture(["system", "df", "--format", "{{json .}}"]);
    if (df.code !== 0) {
      throw new OperationFailedError("docker.command-failed", { command: "system df", detail: df.stderr.trim() });
    }
    const data: CleanOutput = { usage: parseDiskUsage(df.stdout), volumes: input.volumes, results: [] };
    if (!input.apply) return preview(data, "--apply");

    const warning = message(input.volumes ? "docker.clean.warn-volumes" : "docker.clean.warn");
    await requireTypedConfirmation(context, warning, CLEAN_CONFIRMATION, input.confirm);
    const targets = ["container", "image", "network", "builder", ...(input.volumes ? ["volume"] : [])];
    const results: PruneResult[] = [];
    const failures: Message[] = [];
    for (const target of targets) {
      if (context.signal.aborted) break;
      const pruned = await engine.capture([target, "prune", "--force"], PRUNE_TIMEOUT_MS);
      const succeeded = pruned.code === 0;
      if (!succeeded) failures.push(message("docker.clean.failed", { target, detail: pruned.stderr.trim() }));
      results.push({ target, succeeded, reclaimed: reclaimedSpace(pruned.stdout) });
    }
    return done({ ...data, results }, { failures });
  }
}

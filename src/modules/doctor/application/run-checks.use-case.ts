import { checkConfigTypes } from "../../../core/application/config-values.js";
import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { KiriyaError } from "../../../core/domain/errors.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { RuntimeInfo } from "../../../core/domain/module.js";
import type { ConfigStore } from "../../../core/domain/ports/config-store.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import type { LoadedPlugin, PluginInventory, PluginProblem } from "../../../core/domain/ports/plugin-inventory.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import type { Trash } from "../../../core/domain/ports/trash.js";
import { isAtLeast } from "../domain/versions.js";

/** The oldest Node.js release kiriya supports, as package.json's engines field says. */
const MINIMUM_NODE = "22.13.0";
const PROBE_TIMEOUT_MS = 20_000;

export type CheckStatus = "ok" | "warn" | "fail";

export interface DoctorCheck {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: Message;
}

export interface DoctorOutput {
  readonly checks: readonly DoctorCheck[];
  readonly plugins: readonly LoadedPlugin[];
  readonly pluginProblems: readonly PluginProblem[];
}

type NoInput = Readonly<Record<string, never>>;

export const doctorSpec: CommandSpec<NoInput> = {
  id: "doctor",
  summary: "doctor.summary",
  examples: ["kiriya doctor", "kiriya doctor --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: { positionals: [], options: {}, parse: () => ({}) },
};

export class RunChecks implements Command<NoInput, DoctorOutput> {
  readonly spec = doctorSpec;

  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly environment: Environment,
    private readonly config: ConfigStore,
    private readonly trash: Trash,
    private readonly plugins: PluginInventory,
    private readonly runtime: RuntimeInfo,
  ) {}

  async execute(_input: NoInput, context: CommandContext): Promise<CommandResult<DoctorOutput>> {
    const loaded = this.plugins.loaded();
    const problems = this.plugins.problems();
    const node = this.runtime.nodeVersion;
    const checks: DoctorCheck[] = [
      { name: "kiriya", status: "ok", detail: message("doctor.check.kiriya", { version: this.runtime.kiriyaVersion }) },
      isAtLeast(node, MINIMUM_NODE)
        ? { name: "node", status: "ok", detail: message("doctor.check.node", { version: node }) }
        : {
            name: "node",
            status: "warn",
            detail: message("doctor.check.node-old", { version: node, minimum: MINIMUM_NODE }),
          },
      { name: "os", status: "ok", detail: message("doctor.check.os", { os: this.environment.os }) },
      await this.configCheck(),
      {
        name: "trash",
        status: "ok",
        detail: message("doctor.check.trash", { location: message(this.trash.location) }),
      },
      await this.gitCheck(context.signal),
      await this.dockerCheck(context.signal),
      {
        name: "plugins",
        status: problems.length > 0 ? "fail" : "ok",
        detail: message("doctor.check.plugins", { loaded: loaded.length, failed: problems.length }),
      },
    ];
    const failures = [
      ...checks.filter((check) => check.status === "fail" && check.name !== "plugins").map((check) => check.detail),
      ...problems.map((problem) => message("doctor.plugin-failed", { entry: problem.entry, reason: problem.reason })),
    ];
    return done({ checks, plugins: loaded, pluginProblems: problems }, { failures });
  }

  private async configCheck(): Promise<DoctorCheck> {
    const path = this.config.path;
    try {
      if (!(await this.config.exists())) {
        return { name: "config", status: "ok", detail: message("doctor.check.config-missing", { path }) };
      }
      checkConfigTypes(await this.config.read(), path);
      return { name: "config", status: "ok", detail: message("doctor.check.config", { path }) };
    } catch (error) {
      if (!(error instanceof KiriyaError)) throw error;
      return { name: "config", status: "fail", detail: error.detail };
    }
  }

  /** The first line a program prints for `args`, or null when it is missing or fails. */
  private async probe(program: string, args: readonly string[], signal: AbortSignal): Promise<string | null> {
    try {
      const result = await this.processRunner.run(program, args, { timeoutMs: PROBE_TIMEOUT_MS, signal });
      const line = result.stdout.trim().split(/\r?\n/)[0] ?? "";
      return result.code === 0 && line !== "" ? line : null;
    } catch (error) {
      if (error instanceof KiriyaError && error.kind !== "interrupted") return null;
      throw error;
    }
  }

  private async gitCheck(signal: AbortSignal): Promise<DoctorCheck> {
    const git = await this.processRunner.find("git");
    const version = git === null ? null : await this.probe(git, ["--version"], signal);
    return version === null
      ? { name: "git", status: "warn", detail: message("doctor.check.git-missing") }
      : { name: "git", status: "ok", detail: message("doctor.check.git", { version }) };
  }

  private async dockerCheck(signal: AbortSignal): Promise<DoctorCheck> {
    const docker = await this.processRunner.find("docker");
    if (docker === null) return { name: "docker", status: "warn", detail: message("doctor.check.docker-missing") };
    const server = await this.probe(docker, ["version", "--format", "{{.Server.Version}}"], signal);
    return server === null
      ? { name: "docker", status: "warn", detail: message("doctor.check.docker-stopped") }
      : { name: "docker", status: "ok", detail: message("doctor.check.docker", { version: server }) };
  }
}

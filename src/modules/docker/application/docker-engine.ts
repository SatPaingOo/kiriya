import { CapabilityUnavailableError } from "../../../core/domain/errors.js";
import type { Passthrough } from "../../../core/domain/ports/passthrough.js";
import type { ProcessResult, ProcessRunner } from "../../../core/domain/ports/process-runner.js";

const PROBE_TIMEOUT_MS = 30_000;

/** The docker CLI with a running engine behind it. */
export class DockerEngine {
  private constructor(
    private readonly runner: ProcessRunner,
    private readonly docker: string,
    private readonly signal: AbortSignal,
  ) {}

  /** CapabilityUnavailableError when docker is not on PATH, or its engine does not answer. */
  static async connect(runner: ProcessRunner, signal: AbortSignal): Promise<DockerEngine> {
    const docker = await runner.find("docker");
    if (docker === null) throw new CapabilityUnavailableError("docker.not-installed");
    const probe = await runner.run(docker, ["version", "--format", "{{.Server.Version}}"], {
      timeoutMs: PROBE_TIMEOUT_MS,
      signal,
    });
    if (probe.code !== 0 || probe.stdout.trim() === "") throw new CapabilityUnavailableError("docker.not-running");
    return new DockerEngine(runner, docker, signal);
  }

  /** For output kiriya reads. */
  capture(args: readonly string[], timeoutMs = 60_000): Promise<ProcessResult> {
    return this.runner.run(this.docker, args, { timeoutMs, signal: this.signal });
  }

  /** For output a person reads as it arrives, such as a build or logs; no time limit, and the exit code back. */
  async stream(args: readonly string[], passthrough: Passthrough): Promise<number> {
    const result = await this.runner.run(this.docker, args, {
      timeoutMs: 0,
      signal: this.signal,
      onOutput: (text, stream) => passthrough.write(text, stream),
    });
    return result.code;
  }
}

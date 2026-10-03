import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { CapabilityUnavailableError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import type { RuntimeInfo } from "../../../core/domain/module.js";
import type { Network } from "../../../core/domain/ports/network.js";
import type { ProcessRunner } from "../../../core/domain/ports/process-runner.js";
import { installSource, type InstallSource } from "../domain/install-source.js";
import { compareVersions, parseVersion, readLatestVersion } from "../domain/versions.js";

/** The registry entry for the version npm serves as `latest`. */
export const LATEST_URL = "https://registry.npmjs.org/kiriya/latest";
/** Long enough for a slow network, short enough that nobody waits on a broken one. */
export const ASK_TIMEOUT_MS = 10_000;
/** That endpoint answers a few kilobytes; a body past this is something else. */
export const MAX_BODY_BYTES = 262_144;
/** An npm install over a slow network outlasts the runner's default minute. */
export const INSTALL_TIMEOUT_MS = 300_000;

export interface SelfUpdateInput {
  readonly apply: boolean;
}

export interface SelfUpdateOutput {
  readonly installed: string;
  /** What the registry calls latest; null when it could not be read. */
  readonly latest: string | null;
  readonly newer: boolean;
  readonly source: InstallSource;
  /** Whether an update was actually run, which only `--apply` does. */
  readonly applied: boolean;
}

export const selfUpdateSpec: CommandSpec<SelfUpdateInput> = {
  id: "self-update",
  summary: "self-update.summary",
  examples: ["kiriya self-update", "kiriya self-update --apply", "kiriya self-update --json"],
  // It replaces an installed program, which a reinstall puts back.
  safety: "write",
  idempotent: true,
  usesNetwork: true,
  runsUserCommands: false,
  // An agent must never upgrade, mid-session, the tool it is calling.
  terminalOnly: true,
  input: {
    positionals: [],
    options: {
      apply: { type: "boolean", description: "self-update.option.apply" },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      return { apply: reader.flag("apply") };
    },
  },
};

export class UpdateSelf implements Command<SelfUpdateInput, SelfUpdateOutput> {
  readonly spec = selfUpdateSpec;

  constructor(
    private readonly network: Network,
    private readonly processRunner: ProcessRunner,
    private readonly runtime: RuntimeInfo,
  ) {}

  async execute(input: SelfUpdateInput, context: CommandContext): Promise<CommandResult<SelfUpdateOutput>> {
    const installed = this.runtime.kiriyaVersion;
    const source = installSource(this.runtime.installDirectory);
    const outcome = await this.network.fetchText(LATEST_URL, ASK_TIMEOUT_MS, MAX_BODY_BYTES, context.signal);

    if (!outcome.ok) {
      const data = { installed, latest: null, newer: false, source, applied: false };
      return done(data, { failures: [message("self-update.unreachable", { failure: outcome.failure })] });
    }
    const latest = outcome.status === 200 ? readLatestVersion(outcome.body) : null;
    if (latest === null) {
      const data = { installed, latest: null, newer: false, source, applied: false };
      return done(data, { failures: [message("self-update.unreadable", { status: outcome.status })] });
    }

    const here = parseVersion(installed);
    const there = parseVersion(latest);
    const newer = here !== null && there !== null && compareVersions(there, here) > 0;
    const base = { installed, latest, newer, source };

    if (!newer || !input.apply) return done({ ...base, applied: false });

    // Only npm put kiriya here, so only npm is asked to replace it.
    if (source !== "npm") {
      return done({ ...base, applied: false }, { failures: [message("self-update.not-npm", { latest })] });
    }
    const npm = await this.processRunner.find("npm");
    if (npm === null) throw new CapabilityUnavailableError("self-update.no-npm");
    const result = await this.processRunner.run(npm, ["install", "--global", `kiriya@${latest}`], {
      signal: context.signal,
      // An install over a slow network outlasts the default minute.
      timeoutMs: INSTALL_TIMEOUT_MS,
      // Shown as it arrives, because this is the one command that can take a while.
      onOutput: (text, stream) => context.passthrough.write(text, stream),
    });
    if (result.code !== 0) {
      return done(
        { ...base, applied: false },
        { failures: [message("self-update.failed", { code: result.code, detail: result.stderr.trim() })] },
      );
    }
    return done({ ...base, applied: true });
  }
}

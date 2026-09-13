import type { MessageKey } from "../../i18n/locales/en.js";
import type { Command } from "./command.js";
import type { Clock } from "./ports/clock.js";
import type { Compression } from "./ports/compression.js";
import type { Environment } from "./ports/environment.js";
import type { FileContent } from "./ports/file-content.js";
import type { FileSystem } from "./ports/file-system.js";
import type { Hasher } from "./ports/hasher.js";
import type { ProcessRunner } from "./ports/process-runner.js";
import type { ProtectedPaths } from "./ports/protected-paths.js";
import type { Trash } from "./ports/trash.js";
import type { TextView } from "./view.js";

/** The ports every module may use. A command's constructor takes only the ones it calls. */
export interface CorePorts {
  readonly fileSystem: FileSystem;
  readonly fileContent: FileContent;
  readonly hasher: Hasher;
  readonly compression: Compression;
  readonly processRunner: ProcessRunner;
  readonly trash: Trash;
  readonly environment: Environment;
  readonly clock: Clock;
  readonly protectedPaths: ProtectedPaths;
}

export interface CommandRegistrar {
  add<Input, Output>(command: Command<Input, Output>, view: TextView<Output>): void;
}

/** The contract for built-in modules and plugins alike. */
export interface KiriyaModule {
  readonly id: string;
  readonly summary: MessageKey;
  register(registrar: CommandRegistrar, ports: CorePorts): void;
}

import { createInterface } from "node:readline";
import type { CommandRegistry } from "../../application/command-registry.js";
import { mcpAllowsDestroy, mcpAllowsWrite } from "../../application/config-values.js";
import { RootScope } from "../../application/root-scope.js";
import { KiriyaError } from "../../domain/errors.js";
import { RawReader, type InputSchema } from "../../domain/input-schema.js";
import { message, type Message } from "../../domain/message.js";
import type { Clock } from "../../domain/ports/clock.js";
import type { ConfigStore } from "../../domain/ports/config-store.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { RandomSource } from "../../domain/ports/random-source.js";
import { Translator } from "../i18n/translator.js";
import { McpServer } from "./mcp-server.js";

export interface McpInput {
  readonly roots: readonly string[];
}

/** What `kiriya mcp` takes on its command line. */
export const MCP_INPUT: InputSchema<McpInput> = {
  positionals: [{ name: "folders", description: "core.mcp.arg.folders", required: false, variadic: true, path: true }],
  options: {
    root: { type: "string", multiple: true, path: true, description: "core.mcp.option.root", valueName: "<folder>" },
  },
  // Folders as arguments serve an app that passes a list of them, such as the one an MCP bundle starts.
  parse: (raw) => {
    const reader = new RawReader(raw);
    return { roots: [...reader.positionalsFrom(0), ...reader.strings("root")] };
  },
};

export interface McpDependencies {
  readonly registry: CommandRegistry;
  /** kiriya's English catalog, plus the messages of loaded plugins. */
  readonly catalog: Readonly<Record<string, string>>;
  readonly version: string;
  readonly fileSystem: FileSystem;
  readonly config: ConfigStore;
  readonly random: RandomSource;
  readonly clock: Clock;
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

/**
 * `kiriya mcp`: one JSON-RPC message per line on stdin and stdout until stdin closes.
 * Only protocol messages reach stdout; diagnostics go to stderr. A root that is not a
 * folder stops it before it reads anything. The settings are read once, at the start.
 */
export async function serveMcp(deps: McpDependencies, input: McpInput, cwd: string): Promise<number> {
  const translator = new Translator(deps.catalog);
  const log = (value: Message): void => {
    deps.stderr.write(`${translator.text(value)}\n`);
  };
  const scope = await RootScope.open(deps.fileSystem, input.roots, cwd, [deps.config.path]);
  // A configuration file that cannot be read allows nothing beyond reading.
  const settings = await deps.config.read().then(
    (values) => ({ allowWrite: mcpAllowsWrite(values), allowDestroy: mcpAllowsDestroy(values) }),
    (error: unknown) => {
      const detail = error instanceof KiriyaError ? translator.text(error.detail) : String(error);
      log(message("core.mcp.config-unreadable", { detail }));
      return { allowWrite: false, allowDestroy: false };
    },
  );
  const server = new McpServer({
    registry: deps.registry,
    translator,
    version: deps.version,
    scope,
    ...settings,
    secret: deps.random.bytes(32),
    now: () => deps.clock.now(),
    send: (value) => deps.stdout.write(`${JSON.stringify(value)}\n`),
    log,
  });

  const lines = createInterface({ input: deps.stdin, crlfDelay: Number.POSITIVE_INFINITY });
  // A client that goes away closes stdout too; there is no one left to answer.
  deps.stdout.once("error", () => lines.close());
  for await (const line of lines) {
    if (line.trim() !== "") server.receive(line);
  }
  await server.close();
  await new Promise<void>((resolve) => deps.stdout.write("", () => resolve()));
  return 0;
}

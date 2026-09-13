import { createInterface } from "node:readline";
import type { CommandRegistry } from "../../application/command-registry.js";
import { RootScope } from "../../application/root-scope.js";
import { RawReader, type InputSchema } from "../../domain/input-schema.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import { Translator } from "../i18n/translator.js";
import { McpServer } from "./mcp-server.js";

export interface McpInput {
  readonly roots: readonly string[];
}

/** What `kiriya mcp` takes on its command line. */
export const MCP_INPUT: InputSchema<McpInput> = {
  positionals: [],
  options: {
    root: { type: "string", multiple: true, path: true, description: "core.mcp.option.root", valueName: "<folder>" },
  },
  parse: (raw) => ({ roots: new RawReader(raw).strings("root") }),
};

export interface McpDependencies {
  readonly registry: CommandRegistry;
  /** kiriya's English catalog, plus the messages of loaded plugins. */
  readonly catalog: Readonly<Record<string, string>>;
  readonly version: string;
  readonly fileSystem: FileSystem;
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

/**
 * `kiriya mcp`: one JSON-RPC message per line on stdin and stdout until stdin closes.
 * Only protocol messages reach stdout; diagnostics go to stderr. A root that is not a
 * folder stops it before it reads anything.
 */
export async function serveMcp(deps: McpDependencies, input: McpInput, cwd: string): Promise<number> {
  const translator = new Translator(deps.catalog);
  const scope = await RootScope.open(deps.fileSystem, input.roots, cwd);
  const server = new McpServer({
    registry: deps.registry,
    translator,
    version: deps.version,
    scope,
    send: (value) => deps.stdout.write(`${JSON.stringify(value)}\n`),
    log: (value) => deps.stderr.write(`${translator.text(value)}\n`),
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

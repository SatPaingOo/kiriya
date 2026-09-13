import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { startKiriya } from "./cli.js";

export type Json = { [key: string]: unknown };

export const MODERN_META: Json = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

/** A minimal MCP client on the built CLI's stdio: one JSON-RPC message per line, answers matched by id. */
export class LineClient {
  private readonly waiting = new Map<number, (message: Json) => void>();
  private nextId = 1;
  private buffer = "";
  private stderr = "";

  private constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      this.buffer += chunk;
      for (let end = this.buffer.indexOf("\n"); end >= 0; end = this.buffer.indexOf("\n")) {
        const message = JSON.parse(this.buffer.slice(0, end)) as Json;
        this.buffer = this.buffer.slice(end + 1);
        const id = message["id"];
        if (typeof id === "number") this.waiting.get(id)?.(message);
      }
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      this.stderr += chunk;
    });
  }

  /** `kiriya mcp` with the given arguments, started in `cwd`. */
  static start(cwd: string, args: readonly string[] = []): LineClient {
    return new LineClient(startKiriya(cwd, ["mcp", ...args]));
  }

  /** The whole response, with its `result` or `error`. */
  request(method: string, params?: Json): Promise<Json> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error(`no answer to ${method} within 60 s; stderr: ${this.stderr}`));
      }, 60_000);
      this.waiting.set(id, (message) => {
        clearTimeout(timer);
        this.waiting.delete(id);
        resolve(message);
      });
      this.send({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
    });
  }

  notify(method: string, params?: Json): void {
    this.send({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
  }

  /** A tools/call of the 2026-07-28 version, returning its result. */
  async call(name: string, args: Json = {}): Promise<Json> {
    const response = await this.request("tools/call", { _meta: MODERN_META, name, arguments: args });
    if (response["result"] === undefined) throw new Error(`${name} answered ${JSON.stringify(response)}`);
    return response["result"] as Json;
  }

  /** Closes stdin, the way a client stops the server, and waits for the exit code. */
  async close(): Promise<number | null> {
    if (this.child.exitCode !== null) return this.child.exitCode;
    const closed = once(this.child, "close");
    this.child.stdin.end();
    const [code] = (await closed) as [number | null];
    return code;
  }

  /** Ends a server a failed test left running, and waits until it is gone. */
  async stop(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    const closed = once(this.child, "close");
    this.child.kill();
    await closed;
  }

  private send(message: Json): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }
}

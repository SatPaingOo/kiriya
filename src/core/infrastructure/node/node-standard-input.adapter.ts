import { OperationFailedError } from "../../domain/errors.js";
import type { StandardInput } from "../../domain/ports/standard-input.js";
import { formatBytes } from "../../domain/values/bytes.js";

export class NodeStandardInput implements StandardInput {
  constructor(private readonly stream: NodeJS.ReadStream = process.stdin) {}

  get isTerminal(): boolean {
    return this.stream.isTTY === true;
  }

  async read(maxBytes: number): Promise<Uint8Array> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of this.stream) {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
      total += buffer.length;
      if (total > maxBytes) throw new OperationFailedError("core.stdin.too-large", { limit: formatBytes(maxBytes) });
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }
}

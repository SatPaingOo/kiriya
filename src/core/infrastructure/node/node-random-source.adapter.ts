import { randomFillSync } from "node:crypto";
import type { RandomSource } from "../../domain/ports/random-source.js";

export class NodeRandomSource implements RandomSource {
  bytes(count: number): Uint8Array {
    return randomFillSync(new Uint8Array(count));
  }
}

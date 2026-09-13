import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message, type Message } from "../../../core/domain/message.js";
import type { Clock } from "../../../core/domain/ports/clock.js";
import { claimTime, decodeJwt, type JsonObject } from "../domain/jwt.js";
import { CONVERTER, fileOption, inputText, readInput, valuePositional, type InputSources } from "./convert-input.js";

export interface JwtInput {
  readonly value: string | undefined;
  readonly file: string | undefined;
}

export interface JwtOutput {
  readonly header: JsonObject;
  readonly payload: JsonObject;
  /** ISO 8601 times from the iat, nbf and exp claims; null when a claim is absent. */
  readonly issuedAt: string | null;
  readonly notBefore: string | null;
  readonly expiresAt: string | null;
  /** Measured against this machine's clock; null without an exp claim. */
  readonly expired: boolean | null;
}

export const jwtSpec: CommandSpec<JwtInput> = {
  id: "convert.jwt",
  summary: "convert.jwt.summary",
  examples: ["kiriya convert jwt < token.txt", "kiriya convert jwt --file token.txt --json"],
  ...CONVERTER,
  // Whether a token has expired depends on when it is asked.
  idempotent: false,
  input: {
    positionals: [valuePositional],
    options: { file: fileOption },
    parse(raw) {
      const reader = new RawReader(raw);
      return { value: reader.positional(0), file: reader.string("file") };
    },
  },
};

const isoTime = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

/** Decodes on this machine and never checks the signature: the claims say what the token says, not that it is genuine. */
export class DecodeJwt implements Command<JwtInput, JwtOutput> {
  readonly spec = jwtSpec;

  constructor(
    private readonly sources: InputSources,
    private readonly clock: Clock,
  ) {}

  async execute(input: JwtInput, context: CommandContext): Promise<CommandResult<JwtOutput>> {
    const read = await readInput(this.sources, context.cwd, input.value, input.file);
    const decoded = decodeJwt(inputText(read));
    if (decoded === null) throw new UsageError("convert.jwt.invalid");
    const expires = claimTime(decoded.payload, "exp");
    const warnings: Message[] = [message("convert.jwt.unverified")];
    if (read.from === "argument") warnings.push(message("convert.jwt.from-argument"));
    return done(
      {
        header: decoded.header,
        payload: decoded.payload,
        issuedAt: isoTime(claimTime(decoded.payload, "iat")),
        notBefore: isoTime(claimTime(decoded.payload, "nbf")),
        expiresAt: isoTime(expires),
        expired: expires === null ? null : expires <= this.clock.now(),
      },
      { warnings },
    );
  }
}

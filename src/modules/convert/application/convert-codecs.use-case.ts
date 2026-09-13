import type { Command, CommandContext, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { fromBase64, fromHex, toBase64, toHex, utf8Text } from "../../../core/domain/encodings.js";
import { OperationFailedError, UsageError } from "../../../core/domain/errors.js";
import { RawReader, type OptionSpec } from "../../../core/domain/input-schema.js";
import type { MessageKey } from "../../../i18n/locales/en.js";
import {
  CONVERTER,
  fileOption,
  inputBytes,
  inputText,
  readInput,
  valuePositional,
  type ConvertInput,
  type InputSources,
} from "./convert-input.js";

export interface CodecInput {
  readonly value: string | undefined;
  readonly file: string | undefined;
  readonly decode: boolean;
  readonly urlSafe: boolean;
}

export interface CodecOutput {
  readonly output: string;
}

type CodecName = "base64" | "hex" | "url";

interface Codec {
  readonly encode: (input: ConvertInput, urlSafe: boolean) => string;
  /** Decoded text; throws a typed error for input it cannot decode. */
  readonly decode: (text: string) => string;
}

function decodedText(bytes: Uint8Array | null, invalid: MessageKey): string {
  if (bytes === null) throw new UsageError(invalid);
  const text = utf8Text(bytes);
  if (text === null) throw new OperationFailedError("convert.decoded-binary");
  return text;
}

const CODECS: Readonly<Record<CodecName, Codec>> = {
  base64: {
    encode: (input, urlSafe) => toBase64(inputBytes(input), urlSafe),
    decode: (text) => decodedText(fromBase64(text), "convert.base64.invalid"),
  },
  hex: {
    encode: (input) => toHex(inputBytes(input)),
    decode: (text) => decodedText(fromHex(text), "convert.hex.invalid"),
  },
  url: {
    encode: (input) => encodeURIComponent(inputText(input)),
    decode: (text) => {
      try {
        return decodeURIComponent(text);
      } catch {
        throw new UsageError("convert.url.invalid");
      }
    },
  },
};

const SUMMARIES: Readonly<Record<CodecName, MessageKey>> = {
  base64: "convert.base64.summary",
  hex: "convert.hex.summary",
  url: "convert.url.summary",
};

const EXAMPLES: Readonly<Record<CodecName, readonly string[]>> = {
  base64: [
    'kiriya convert base64 "hello"',
    "kiriya convert base64 --decode aGVsbG8=",
    "kiriya convert base64 --file logo.png",
  ],
  hex: ['kiriya convert hex "hello"', "kiriya convert hex --decode 68656c6c6f"],
  url: ['kiriya convert url "a b&c"', "kiriya convert url --decode a%20b%26c"],
};

function codecSpec(name: CodecName): CommandSpec<CodecInput> {
  const options: Record<string, OptionSpec> = {
    decode: { type: "boolean", description: "convert.option.decode", short: "d" },
    file: fileOption,
  };
  if (name === "base64") options["url"] = { type: "boolean", description: "convert.base64.option.url" };
  return {
    id: `convert.${name}`,
    summary: SUMMARIES[name],
    examples: EXAMPLES[name],
    ...CONVERTER,
    input: {
      positionals: [valuePositional],
      options,
      parse(raw) {
        const reader = new RawReader(raw);
        return {
          value: reader.positional(0),
          file: reader.string("file"),
          decode: reader.flag("decode"),
          urlSafe: reader.flag("url"),
        };
      },
    },
  };
}

/** One command per codec: `convert base64`, `convert hex` and `convert url`. */
export class ConvertCodec implements Command<CodecInput, CodecOutput> {
  readonly spec: CommandSpec<CodecInput>;
  private readonly codec: Codec;

  constructor(
    name: CodecName,
    private readonly sources: InputSources,
  ) {
    this.spec = codecSpec(name);
    this.codec = CODECS[name];
  }

  async execute(input: CodecInput, context: CommandContext): Promise<CommandResult<CodecOutput>> {
    const read = await readInput(this.sources, context.cwd, input.value, input.file);
    const output = input.decode ? this.codec.decode(inputText(read)) : this.codec.encode(read, input.urlSafe);
    return done({ output });
  }
}

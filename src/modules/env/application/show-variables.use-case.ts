import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import { byCodePoint } from "../../../core/domain/names.js";
import type { Environment } from "../../../core/domain/ports/environment.js";
import { isSecretName, looksSecret } from "../../../core/domain/secrets.js";

export interface ShowInput {
  readonly filter: string | undefined;
  readonly reveal: boolean;
}

export interface ShownVariable {
  readonly name: string;
  /** null when the value is hidden. */
  readonly value: string | null;
  /** The name or the value looks like a secret. */
  readonly secret: boolean;
}

export interface ShowOutput {
  readonly variables: readonly ShownVariable[];
  readonly hidden: number;
}

export const showSpec: CommandSpec<ShowInput> = {
  id: "env.show",
  summary: "env.show.summary",
  examples: ["kiriya env show", "kiriya env show java", "kiriya env show token --reveal"],
  safety: "read",
  idempotent: true,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "filter", description: "env.show.arg.filter", required: false, variadic: false }],
    options: { reveal: { type: "boolean", description: "env.show.option.reveal", terminalOnly: true } },
    parse(raw) {
      const reader = new RawReader(raw);
      return { filter: reader.positional(0), reveal: reader.flag("reveal") };
    },
  },
};

/** Values hide when a name or value looks secret, in text and in JSON alike, because both end up in logs. */
export class ShowVariables implements Command<ShowInput, ShowOutput> {
  readonly spec = showSpec;

  constructor(private readonly environment: Environment) {}

  execute(input: ShowInput): Promise<CommandResult<ShowOutput>> {
    const filter = input.filter?.toLowerCase();
    const variables = Object.entries(this.environment.variables())
      .filter(([name]) => filter === undefined || name.toLowerCase().includes(filter))
      .sort(([first], [second]) => byCodePoint(first.toLowerCase(), second.toLowerCase()) || byCodePoint(first, second))
      .map(([name, value]) => {
        const secret = isSecretName(name) || looksSecret(value);
        return { name, value: secret && !input.reveal ? null : value, secret };
      });
    const hidden = variables.filter((variable) => variable.value === null).length;
    const warnings =
      input.reveal && variables.some((variable) => variable.secret) ? [message("env.show.revealed")] : [];
    const failures =
      input.filter !== undefined && variables.length === 0
        ? [message("env.show.no-match", { filter: input.filter })]
        : [];
    return Promise.resolve(done({ variables, hidden }, { warnings, failures }));
  }
}

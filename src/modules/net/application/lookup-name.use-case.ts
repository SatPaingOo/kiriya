import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { UsageError } from "../../../core/domain/errors.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import { message } from "../../../core/domain/message.js";
import {
  DNS_RECORD_TYPES,
  type DnsRecord,
  type DnsRecordType,
  type LookupFailure,
  type Network,
} from "../../../core/domain/ports/network.js";
import type { MessageKey } from "../../../i18n/locales/en.js";

const LOOKUP_TYPES = ["system", ...DNS_RECORD_TYPES] as const;
const DNS_TIMEOUT_MS = 5_000;

export interface DnsInput {
  readonly name: string;
  /** `system` asks the OS, as programs do; a record type asks the DNS servers. */
  readonly type: "system" | DnsRecordType;
}

export interface DnsOutput {
  readonly name: string;
  readonly type: "system" | DnsRecordType;
  readonly records: readonly DnsRecord[];
  readonly failure: LookupFailure | null;
}

export const dnsSpec: CommandSpec<DnsInput> = {
  id: "net.dns",
  summary: "net.dns.summary",
  examples: ["kiriya net dns example.com", "kiriya net dns example.com --type mx", "kiriya net dns localhost --json"],
  safety: "read",
  idempotent: true,
  usesNetwork: true,
  runsUserCommands: false,
  input: {
    positionals: [{ name: "name", description: "net.dns.arg.name", required: true, variadic: false }],
    options: {
      type: { type: "string", description: "net.dns.option.type", choices: LOOKUP_TYPES },
    },
    parse(raw) {
      const reader = new RawReader(raw);
      const name = reader.positional(0)?.trim() ?? "";
      if (name === "") throw new UsageError("net.dns.name-missing");
      return { name, type: reader.choice("type", LOOKUP_TYPES, "system") };
    },
  },
};

const FAILURE_KEYS: Readonly<Record<LookupFailure, MessageKey>> = {
  "not-found": "net.dns.not-found",
  timeout: "net.dns.timeout",
  failed: "net.dns.failed",
};

export class LookupName implements Command<DnsInput, DnsOutput> {
  readonly spec = dnsSpec;

  constructor(private readonly network: Network) {}

  async execute(input: DnsInput): Promise<CommandResult<DnsOutput>> {
    const outcome =
      input.type === "system"
        ? await this.network.lookup(input.name)
        : await this.network.resolve(input.name, input.type, DNS_TIMEOUT_MS);
    if (outcome.ok) return done({ name: input.name, type: input.type, records: outcome.records, failure: null });
    const params = {
      name: input.name,
      type: input.type === "system" ? "address" : input.type.toUpperCase(),
      code: outcome.code ?? outcome.failure,
    };
    return done(
      { name: input.name, type: input.type, records: [], failure: outcome.failure },
      { failures: [message(FAILURE_KEYS[outcome.failure], params)] },
    );
  }
}

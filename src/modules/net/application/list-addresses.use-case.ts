import type { Command, CommandResult, CommandSpec } from "../../../core/domain/command.js";
import { done } from "../../../core/domain/command.js";
import { RawReader } from "../../../core/domain/input-schema.js";
import type { Network, NetworkAddress } from "../../../core/domain/ports/network.js";

export interface AddressesInput {
  readonly all: boolean;
}

export interface AddressesOutput {
  readonly addresses: readonly NetworkAddress[];
}

export const addressesSpec: CommandSpec<AddressesInput> = {
  id: "net.ip",
  summary: "net.ip.summary",
  examples: ["kiriya net ip", "kiriya net ip --all --json"],
  safety: "read",
  // Addresses change when the machine joins another network.
  idempotent: false,
  usesNetwork: false,
  runsUserCommands: false,
  input: {
    positionals: [],
    options: { all: { type: "boolean", description: "net.ip.option.all" } },
    parse: (raw) => ({ all: new RawReader(raw).flag("all") }),
  },
};

export class ListAddresses implements Command<AddressesInput, AddressesOutput> {
  readonly spec = addressesSpec;

  constructor(private readonly network: Network) {}

  execute(input: AddressesInput): Promise<CommandResult<AddressesOutput>> {
    const addresses = this.network.addresses().filter((address) => input.all || !address.internal);
    return Promise.resolve(done({ addresses }));
  }
}

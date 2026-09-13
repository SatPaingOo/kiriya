import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { CheckOutput } from "../application/check-connection.use-case.js";
import type { AddressesOutput } from "../application/list-addresses.use-case.js";
import type { DnsOutput } from "../application/lookup-name.use-case.js";
import { formatTarget } from "../domain/targets.js";

const NO_MAC = "00:00:00:00:00:00";

/** Addresses under the interface they belong to. */
export const addressesView: TextView<AddressesOutput> = (output, format) => {
  if (output.addresses.length === 0) return [format.dim(format.text(message("net.ip.none")))];
  const macLabel = format.text(message("net.ip.mac"));
  const width = Math.max(4, macLabel.length);
  const lines: string[] = [];
  for (const name of new Set(output.addresses.map((address) => address.interfaceName))) {
    const entries = output.addresses.filter((address) => address.interfaceName === name);
    lines.push(format.bold(name));
    for (const entry of entries) lines.push(`  ${entry.family.padEnd(width)}  ${entry.cidr ?? entry.address}`);
    const mac = entries[0]?.mac;
    if (mac !== undefined && mac !== NO_MAC) lines.push(format.dim(`  ${macLabel.padEnd(width)}  ${mac}`));
  }
  return lines;
};

/** An unreachable target arrives as a failure. */
export const checkView: TextView<CheckOutput> = (output, format) =>
  output.reachable
    ? [
        format.green(
          format.text(
            message("net.check.reachable", {
              target: formatTarget(output),
              ms: output.ms,
              address: output.address ?? output.host,
            }),
          ),
        ),
      ]
    : [];

export const dnsView: TextView<DnsOutput> = (output) => {
  const width = Math.max(0, ...output.records.map((record) => record.type.length));
  return output.records.map((record) => {
    const priority = record.priority === null ? "" : `${record.priority} `;
    return `  ${record.type.padEnd(width)}  ${priority}${record.value}`;
  });
};

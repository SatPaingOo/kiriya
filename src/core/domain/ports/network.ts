export type AddressFamily = "IPv4" | "IPv6";

export interface NetworkAddress {
  readonly interfaceName: string;
  readonly family: AddressFamily;
  readonly address: string;
  /** Such as 192.168.1.20/24; null when the OS does not say. */
  readonly cidr: string | null;
  readonly mac: string;
  /** A loopback address, reachable only from this machine. */
  readonly internal: boolean;
}

export type ConnectFailure = "refused" | "timeout" | "not-found" | "unreachable" | "failed";

export type ConnectOutcome =
  | { readonly ok: true; readonly address: string; readonly ms: number }
  | { readonly ok: false; readonly failure: ConnectFailure; readonly code: string | null; readonly ms: number };

export const DNS_RECORD_TYPES = ["a", "aaaa", "cname", "mx", "txt", "ns"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export interface DnsRecord {
  /** A, AAAA, CNAME, MX, TXT or NS. */
  readonly type: string;
  readonly value: string;
  /** An MX record's preference; null for every other record. */
  readonly priority: number | null;
}

export type LookupFailure = "not-found" | "timeout" | "failed";

export type LookupOutcome =
  | { readonly ok: true; readonly records: readonly DnsRecord[] }
  | { readonly ok: false; readonly failure: LookupFailure; readonly code: string | null };

/** This machine's network: its own addresses, TCP connections out, and name lookups. */
export interface Network {
  addresses(): readonly NetworkAddress[];
  /** Opens a TCP connection and closes it at once. Aborting the signal throws InterruptedError. */
  connect(host: string, port: number, timeoutMs: number, signal: AbortSignal): Promise<ConnectOutcome>;
  /** Addresses as programs on this machine get them: the hosts file first, then DNS. */
  lookup(name: string): Promise<LookupOutcome>;
  /** Records of one type, asked of the DNS servers directly. */
  resolve(name: string, type: DnsRecordType, timeoutMs: number): Promise<LookupOutcome>;
}

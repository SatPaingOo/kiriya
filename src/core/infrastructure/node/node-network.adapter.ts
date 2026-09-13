import { Resolver, lookup as systemLookup } from "node:dns/promises";
import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";
import { InterruptedError } from "../../domain/errors.js";
import type {
  ConnectFailure,
  ConnectOutcome,
  DnsRecord,
  DnsRecordType,
  LookupFailure,
  LookupOutcome,
  Network,
  NetworkAddress,
} from "../../domain/ports/network.js";

const CONNECT_FAILURES: Readonly<Record<string, ConnectFailure>> = {
  ECONNREFUSED: "refused",
  ETIMEDOUT: "timeout",
  ENOTFOUND: "not-found",
  EAI_AGAIN: "not-found",
  EAI_NONAME: "not-found",
  EHOSTUNREACH: "unreachable",
  ENETUNREACH: "unreachable",
  EADDRNOTAVAIL: "unreachable",
};

const LOOKUP_FAILURES: Readonly<Record<string, LookupFailure>> = {
  ENOTFOUND: "not-found",
  ENODATA: "not-found",
  EAI_NONAME: "not-found",
  ETIMEOUT: "timeout",
  EAI_AGAIN: "timeout",
};

/** The code Node.js gives an error, looking inside the AggregateError that trying several addresses produces. */
function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  if (error instanceof AggregateError) return errorCode((error.errors as unknown[])[0]);
  return null;
}

function lookupFailure(error: unknown): LookupOutcome {
  const code = errorCode(error);
  return { ok: false, failure: (code === null ? undefined : LOOKUP_FAILURES[code]) ?? "failed", code };
}

async function records(resolver: Resolver, name: string, type: DnsRecordType): Promise<DnsRecord[]> {
  const plain =
    (recordType: string) =>
    (value: string): DnsRecord => ({ type: recordType, value, priority: null });
  switch (type) {
    case "a":
      return (await resolver.resolve4(name)).map(plain("A"));
    case "aaaa":
      return (await resolver.resolve6(name)).map(plain("AAAA"));
    case "cname":
      return (await resolver.resolveCname(name)).map(plain("CNAME"));
    case "ns":
      return (await resolver.resolveNs(name)).map(plain("NS"));
    case "txt":
      // A TXT record arrives in chunks of at most 255 characters.
      return (await resolver.resolveTxt(name)).map((chunks) => plain("TXT")(chunks.join("")));
    case "mx":
      return (await resolver.resolveMx(name))
        .sort((first, second) => first.priority - second.priority)
        .map((entry) => ({ type: "MX", value: entry.exchange, priority: entry.priority }));
  }
}

export class NodeNetworkAdapter implements Network {
  addresses(): readonly NetworkAddress[] {
    return Object.entries(networkInterfaces()).flatMap(([interfaceName, entries]) =>
      (entries ?? []).map((entry) => ({
        interfaceName,
        family: entry.family,
        address: entry.address,
        cidr: entry.cidr,
        mac: entry.mac,
        internal: entry.internal,
      })),
    );
  }

  connect(host: string, port: number, timeoutMs: number, signal: AbortSignal): Promise<ConnectOutcome> {
    if (signal.aborted) return Promise.reject(new InterruptedError("core.error.interrupted"));
    return new Promise((resolve, reject) => {
      const started = performance.now();
      const elapsed = (): number => Math.round(performance.now() - started);
      const socket = createConnection({ host, port });
      // null means the run was interrupted.
      const settle = (outcome: ConnectOutcome | null): void => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        socket.destroy();
        if (outcome === null) reject(new InterruptedError("core.error.interrupted"));
        else resolve(outcome);
      };
      const onAbort = (): void => settle(null);
      const timer = setTimeout(() => settle({ ok: false, failure: "timeout", code: null, ms: elapsed() }), timeoutMs);
      signal.addEventListener("abort", onAbort, { once: true });
      socket.once("connect", () => settle({ ok: true, address: socket.remoteAddress ?? host, ms: elapsed() }));
      socket.once("error", (error) => {
        const code = errorCode(error);
        const failure = (code === null ? undefined : CONNECT_FAILURES[code]) ?? "failed";
        settle({ ok: false, failure, code, ms: elapsed() });
      });
    });
  }

  async lookup(name: string): Promise<LookupOutcome> {
    try {
      const found = await systemLookup(name, { all: true });
      const addresses = found.map((entry) => ({
        type: entry.family === 6 ? "AAAA" : "A",
        value: entry.address,
        priority: null,
      }));
      return { ok: true, records: addresses };
    } catch (error) {
      return lookupFailure(error);
    }
  }

  async resolve(name: string, type: DnsRecordType, timeoutMs: number): Promise<LookupOutcome> {
    const resolver = new Resolver({ timeout: timeoutMs, tries: 2 });
    try {
      return { ok: true, records: await records(resolver, name, type) };
    } catch (error) {
      return lookupFailure(error);
    }
  }
}

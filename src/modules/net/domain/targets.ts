export interface Target {
  readonly host: string;
  readonly port: number;
}

/** The ports URL schemes use when a URL names none. */
const DEFAULT_PORTS: Readonly<Record<string, number>> = {
  "http:": 80,
  "https:": 443,
  "ws:": 80,
  "wss:": 443,
  "ftp:": 21,
  "ssh:": 22,
};

function validPort(text: string): number | null {
  if (!/^\d{1,5}$/.test(text)) return null;
  const port = Number(text);
  return port >= 1 && port <= 65_535 ? port : null;
}

/** `host:port`, `[IPv6]:port`, or a URL such as https://example.com whose scheme gives the port; null for anything else. */
export function parseTarget(text: string): Target | null {
  const value = text.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    const port = url.port === "" ? (DEFAULT_PORTS[url.protocol] ?? null) : validPort(url.port);
    const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
    return port === null || host === "" ? null : { host, port };
  }
  const match = /^\[([^\]]+)\]:(\d+)$/.exec(value) ?? /^([^:\s[\]]+):(\d+)$/.exec(value);
  if (match === null) return null;
  const port = validPort(match[2] ?? "");
  return port === null ? null : { host: match[1] ?? "", port };
}

/** host:port, with an IPv6 address in brackets. */
export function formatTarget(target: Target): string {
  return target.host.includes(":") ? `[${target.host}]:${target.port}` : `${target.host}:${target.port}`;
}

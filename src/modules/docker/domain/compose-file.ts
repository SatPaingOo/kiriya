/** The file names docker compose looks for in a folder, in the order it prefers them. */
export const COMPOSE_FILE_NAMES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"] as const;

export interface ComposeService {
  readonly name: string;
  readonly container: string | null;
  readonly ports: readonly string[];
  readonly buildContext: string | null;
}

export interface ComposeSummary {
  /** The top-level `name`, or the name docker compose derives from the folder. */
  readonly project: string;
  readonly services: readonly ComposeService[];
}

export interface PortMapping {
  readonly host: string;
  readonly service: string;
  readonly target: string;
}

/** The project name docker compose derives from a folder name: lower case, letters, digits, `-` and `_`. */
export function projectNameFromFolder(folderName: string): string {
  return folderName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  if ((first === '"' || first === "'") && trimmed.length >= 2 && trimmed.endsWith(first)) return trimmed.slice(1, -1);
  return trimmed;
}

interface MutableService {
  name: string;
  container: string | null;
  ports: string[];
  buildContext: string | null;
}

/**
 * Just enough YAML to show a project: the top-level name, the services, and each
 * service's container_name, ports and build context. It is not a YAML parser, and
 * docker compose itself stays the authority on the file.
 */
export function parseCompose(text: string, fallbackProject: string): ComposeSummary {
  let project = fallbackProject;
  const services: MutableService[] = [];
  let inServices = false;
  let serviceIndent = -1;
  let current: MutableService | undefined;
  let portsIndent = -1;
  let buildIndent = -1;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      inServices = trimmed === "services:";
      current = undefined;
      portsIndent = -1;
      buildIndent = -1;
      const name = /^name:\s*(.+)$/.exec(trimmed);
      if (name?.[1] !== undefined) project = unquote(name[1]);
      continue;
    }
    if (!inServices) continue;

    if (serviceIndent < 0) serviceIndent = indent;
    if (indent === serviceIndent) {
      const key = /^([A-Za-z0-9_.-]+):\s*$/.exec(trimmed);
      if (key?.[1] !== undefined) {
        current = { name: key[1], container: null, ports: [], buildContext: null };
        services.push(current);
      }
      portsIndent = -1;
      buildIndent = -1;
      continue;
    }
    if (current === undefined) continue;

    if (portsIndent >= 0 && indent > portsIndent && trimmed.startsWith("-")) {
      current.ports.push(unquote(trimmed.slice(1)));
      continue;
    }
    portsIndent = -1;

    if (buildIndent >= 0 && indent > buildIndent) {
      const context = /^context:\s*(.+)$/.exec(trimmed);
      if (context?.[1] !== undefined) current.buildContext = unquote(context[1]);
      continue;
    }
    buildIndent = -1;

    const pair = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(trimmed);
    if (pair === null) continue;
    const key = pair[1];
    const value = pair[2] ?? "";
    if (key === "container_name" && value !== "") current.container = unquote(value);
    else if (key === "ports" && value === "") portsIndent = indent;
    else if (key === "build" && value === "") buildIndent = indent;
    else if (key === "build") current.buildContext = unquote(value);
  }
  return { project, services };
}

/**
 * Published ports as host and container port: "8080:80" and "127.0.0.1:8080:80/tcp" both
 * give 8080 and 80. A port with no host side is published at a random port and left out.
 */
export function portMappings(services: readonly ComposeService[]): PortMapping[] {
  const mappings: PortMapping[] = [];
  for (const service of services) {
    for (const port of service.ports) {
      const parts = port.replace(/\/(tcp|udp|sctp)$/i, "").split(":");
      const target = parts[parts.length - 1];
      const host = parts[parts.length - 2];
      if (host === undefined || target === undefined || host === "") continue;
      mappings.push({ host, service: service.name, target });
    }
  }
  return mappings;
}

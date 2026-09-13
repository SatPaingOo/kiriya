export interface Container {
  readonly name: string;
  readonly service: string;
  readonly state: string;
  readonly status: string;
  readonly ports: string;
}

export interface ComposeProjectState {
  readonly name: string;
  readonly status: string;
  readonly configFiles: string;
}

export interface DiskUsage {
  readonly type: string;
  readonly total: string;
  readonly active: string;
  readonly size: string;
  readonly reclaimable: string;
}

type JsonRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseLine(line: string): JsonRecord[] {
  try {
    const parsed: unknown = JSON.parse(line);
    return isRecord(parsed) ? [parsed] : [];
  } catch {
    return [];
  }
}

/** Docker prints JSON as one array or as one object per line, depending on the command and version. */
export function parseJsonRecords(text: string): JsonRecord[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(/\r?\n/).flatMap(parseLine);
}

function field(record: JsonRecord, name: string): string {
  const value = record[name];
  if (typeof value === "string") return value;
  return typeof value === "number" ? String(value) : "";
}

/** `docker compose ps --all --format json`. */
export function parseContainers(text: string): Container[] {
  return parseJsonRecords(text).map((record) => ({
    name: field(record, "Name"),
    service: field(record, "Service"),
    state: field(record, "State"),
    status: field(record, "Status"),
    ports: field(record, "Ports"),
  }));
}

/** `docker compose ls --all --format json`. */
export function parseProjects(text: string): ComposeProjectState[] {
  return parseJsonRecords(text).map((record) => ({
    name: field(record, "Name"),
    status: field(record, "Status"),
    configFiles: field(record, "ConfigFiles"),
  }));
}

/** `docker system df --format "{{json .}}"`. */
export function parseDiskUsage(text: string): DiskUsage[] {
  return parseJsonRecords(text).map((record) => ({
    type: field(record, "Type"),
    total: field(record, "TotalCount"),
    active: field(record, "Active"),
    size: field(record, "Size"),
    reclaimable: field(record, "Reclaimable"),
  }));
}

/** "Total reclaimed space: 1.2GB" in a prune command's output, as "1.2GB"; null when absent. */
export function reclaimedSpace(text: string): string | null {
  return /Total reclaimed space:\s*(\S+)/i.exec(text)?.[1] ?? null;
}

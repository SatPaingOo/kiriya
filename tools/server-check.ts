/** What must hold between server.json, which the MCP Registry reads, and package.json, which npm publishes. */

export interface PackageFacts {
  readonly name: string;
  readonly version: string;
  readonly mcpName?: string | undefined;
}

type Json = { readonly [key: string]: unknown };

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The registry's limit on a server's description, in characters. */
const DESCRIPTION_LIMIT = 100;

/** Problems that would make the registry refuse the server or point at the wrong package; none when the two agree. */
export function serverProblems(manifest: PackageFacts, server: unknown): string[] {
  if (!isObject(server)) return ["server.json is not a JSON object"];
  const problems: string[] = [];

  if (manifest.mcpName === undefined) {
    problems.push('package.json has no "mcpName", which the registry checks on npm');
  } else if (server["name"] !== manifest.mcpName) {
    problems.push(`server.json is named ${String(server["name"])}, but package.json's mcpName is ${manifest.mcpName}`);
  }
  const description = server["description"];
  if (typeof description !== "string" || description.length === 0 || description.length > DESCRIPTION_LIMIT) {
    problems.push(`server.json needs a description of 1 to ${DESCRIPTION_LIMIT} characters`);
  }
  if (server["version"] !== manifest.version) {
    problems.push(`server.json has version ${String(server["version"])}, but package.json has ${manifest.version}`);
  }

  const packages = Array.isArray(server["packages"]) ? server["packages"].filter(isObject) : [];
  const npm = packages.find((entry) => entry["registryType"] === "npm");
  if (npm === undefined) {
    problems.push("server.json lists no npm package");
    return problems;
  }
  if (npm["identifier"] !== manifest.name) {
    problems.push(`server.json's npm package is ${String(npm["identifier"])}, not ${manifest.name}`);
  }
  if (npm["version"] !== manifest.version) {
    problems.push(
      `server.json's npm package has version ${String(npm["version"])}, but package.json has ${manifest.version}`,
    );
  }
  const transport = npm["transport"];
  if (!isObject(transport) || transport["type"] !== "stdio") {
    problems.push("server.json's npm package does not use the stdio transport");
  }
  const first: unknown = Array.isArray(npm["packageArguments"]) ? npm["packageArguments"][0] : undefined;
  if (!isObject(first) || first["type"] !== "positional" || first["value"] !== "mcp") {
    problems.push('server.json does not start the package with the argument "mcp"');
  }
  return problems;
}

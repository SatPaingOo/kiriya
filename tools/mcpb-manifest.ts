/**
 * The manifest of kiriya's MCP Bundle (.mcpb), which Claude's desktop app installs in one
 * click, built from package.json so the two never disagree. Manifest version 0.3 of
 * https://github.com/modelcontextprotocol/mcpb.
 */

export interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author?: string;
  readonly license?: string;
  readonly homepage?: string;
  readonly keywords?: readonly string[];
  readonly repository?: { readonly url: string };
  readonly bugs?: { readonly url: string };
  readonly engines?: { readonly node?: string };
}

/** Where the program sits inside the bundle, the same path as in the npm package. */
export const ENTRY_POINT = "dist/src/main.js";

/** The folders the user picks in the app. A list becomes one argument per folder, which `kiriya mcp` takes as its roots. */
const FOLDERS = "${user_config.folders}";
const BUNDLE_DIRECTORY = "${__dirname}";

export function bundleManifest(pkg: PackageManifest): Record<string, unknown> {
  const repository = pkg.repository?.url.replace(/^git\+/, "");
  return {
    manifest_version: "0.3",
    name: pkg.name,
    display_name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: { name: pkg.author ?? pkg.name },
    ...(repository === undefined ? {} : { repository: { type: "git", url: repository } }),
    ...(pkg.homepage === undefined ? {} : { homepage: pkg.homepage }),
    ...(pkg.bugs === undefined ? {} : { support: pkg.bugs.url }),
    ...(pkg.license === undefined ? {} : { license: pkg.license }),
    keywords: [...(pkg.keywords ?? [])],
    server: {
      type: "node",
      entry_point: ENTRY_POINT,
      mcp_config: { command: "node", args: [`${BUNDLE_DIRECTORY}/${ENTRY_POINT}`, "mcp", FOLDERS], env: {} },
    },
    // Which tools exist depends on the user's settings, so none are declared up front.
    tools_generated: true,
    compatibility: {
      platforms: ["darwin", "win32", "linux"],
      ...(pkg.engines?.node === undefined ? {} : { runtimes: { node: pkg.engines.node } }),
    },
    user_config: {
      folders: {
        type: "directory",
        title: "Folders",
        description: "The folders kiriya's tools may reach. Paths outside them are refused.",
        multiple: true,
        required: true,
      },
    },
  };
}

/** The package.json inside the bundle: enough for Node.js to load ES modules and for kiriya to know its version. */
export function runtimePackage(pkg: PackageManifest): Record<string, unknown> {
  return {
    name: pkg.name,
    version: pkg.version,
    type: "module",
    ...(pkg.license === undefined ? {} : { license: pkg.license }),
  };
}

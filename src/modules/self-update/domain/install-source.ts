/** How this kiriya got onto the machine, which decides whether it may run a package manager. */

export const INSTALL_SOURCES = ["npm", "elsewhere"] as const;
export type InstallSource = (typeof INSTALL_SOURCES)[number];

/**
 * `npm` when kiriya's own files sit inside a `node_modules/kiriya` folder, which is where npm
 * puts a package and nowhere else puts anything. A source checkout linked with `npm link`
 * resolves to the repository instead, and a future Homebrew tap or single file would too, so
 * both read as `elsewhere` and self-update refuses to run npm over them.
 */
export function installSource(installDirectory: string): InstallSource {
  const parts = installDirectory.replace(/\\/g, "/").split("/").filter(Boolean);
  for (let index = 0; index + 1 < parts.length; index += 1) {
    if (parts[index] === "node_modules" && parts[index + 1] === "kiriya") return "npm";
  }
  return "elsewhere";
}

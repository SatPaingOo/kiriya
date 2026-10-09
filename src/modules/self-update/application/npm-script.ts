import path from "node:path";

/**
 * Where npm's own entry script sits, relative to the node binary running kiriya, newest
 * layout first. npm is a JavaScript program everywhere; what differs is only where the
 * installer puts it.
 *
 * Windows keeps it beside node, and reaches it through `npm.cmd`; Linux and macOS keep it
 * under `lib` and reach it through a symlink called `npm`. Between them the two paths cover
 * the official installers, nvm, nvm-windows, fnm and a distribution's own package.
 */
export function npmScriptCandidates(nodeExecutable: string): readonly string[] {
  const beside = path.dirname(nodeExecutable);
  const script = path.join("npm", "bin", "npm-cli.js");
  return [path.join(beside, "node_modules", script), path.join(beside, "..", "lib", "node_modules", script)];
}

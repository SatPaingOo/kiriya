import path from "node:path";
import { NotFoundError } from "../../../core/domain/errors.js";
import type { OptionSpec, PositionalSpec } from "../../../core/domain/input-schema.js";
import type { FileContent } from "../../../core/domain/ports/file-content.js";
import type { FileSystem } from "../../../core/domain/ports/file-system.js";
import {
  COMPOSE_FILE_NAMES,
  parseCompose,
  projectNameFromFolder,
  type ComposeService,
} from "../domain/compose-file.js";

export interface ComposeProject {
  readonly name: string;
  readonly file: string;
  readonly folder: string;
  readonly services: readonly ComposeService[];
}

export const fileOption: OptionSpec = {
  type: "string",
  description: "docker.option.file",
  valueName: "<compose.yaml>",
};

export const servicesPositional: PositionalSpec = {
  name: "services",
  description: "docker.arg.services",
  required: false,
  variadic: true,
};

/** The compose file --file names, or the one docker compose would pick in the working folder. */
export async function findComposeProject(
  fileSystem: FileSystem,
  content: FileContent,
  cwd: string,
  fileArg: string | undefined,
): Promise<ComposeProject> {
  let file: string | null = null;
  if (fileArg !== undefined) {
    const target = path.resolve(cwd, fileArg);
    if ((await fileSystem.stat(target))?.kind !== "file")
      throw new NotFoundError("core.fs.not-found", { path: target });
    file = target;
  } else {
    for (const name of COMPOSE_FILE_NAMES) {
      const candidate = path.join(cwd, name);
      if ((await fileSystem.stat(candidate))?.kind === "file") {
        file = candidate;
        break;
      }
    }
  }
  if (file === null) throw new NotFoundError("docker.no-compose-file", { folder: cwd });
  const folder = path.dirname(file);
  const text = new TextDecoder().decode(await content.read(file));
  const summary = parseCompose(text, projectNameFromFolder(path.basename(folder)));
  return { name: summary.project, file, folder, services: summary.services };
}

/** Arguments for `docker compose` that pin the file and folder, so it never picks up another project. */
export function composeArgs(project: ComposeProject, args: readonly string[]): string[] {
  return ["compose", "--file", project.file, "--project-directory", project.folder, ...args];
}

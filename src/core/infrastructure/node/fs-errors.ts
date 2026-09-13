import { ConflictError, NotFoundError, OperationFailedError, RefusedError } from "../../domain/errors.js";

export function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException).code ?? "UNKNOWN";
}

const MISSING: ReadonlySet<string> = new Set(["ENOENT", "ENOTDIR"]);

export function isMissing(error: unknown): boolean {
  return MISSING.has(errorCode(error));
}

/** Node.js errors become typed errors here, so no errno code reaches a use case. */
export function translateFsError(error: unknown, path: string): never {
  const code = errorCode(error);
  if (MISSING.has(code)) throw new NotFoundError("core.fs.not-found", { path }, { cause: error });
  if (code === "EACCES" || code === "EPERM") throw new RefusedError("core.fs.permission", { path }, { cause: error });
  if (code === "EEXIST" || code === "ERR_FS_CP_EEXIST")
    throw new ConflictError("core.fs.exists", { path }, { cause: error });
  if (code === "EISDIR") throw new ConflictError("core.fs.is-folder", { path }, { cause: error });
  throw new OperationFailedError("core.fs.failed", { path, detail: code }, { cause: error });
}

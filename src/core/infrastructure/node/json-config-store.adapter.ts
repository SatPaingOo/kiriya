import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { OperationFailedError } from "../../domain/errors.js";
import type { ConfigStore, ConfigValue, ConfigValues } from "../../domain/ports/config-store.js";
import { isMissing, translateFsError } from "./fs-errors.js";

export class JsonConfigStore implements ConfigStore {
  constructor(readonly path: string) {}

  async exists(): Promise<boolean> {
    try {
      await lstat(this.path);
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      return translateFsError(error, this.path);
    }
  }

  async read(): Promise<ConfigValues> {
    let text: string;
    try {
      text = await readFile(this.path, "utf8");
    } catch (error) {
      if (isMissing(error)) return {};
      return translateFsError(error, this.path);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new OperationFailedError("core.config.invalid-json", { path: this.path }, { cause: error });
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new OperationFailedError("core.config.not-an-object", { path: this.path });
    }
    const values: Record<string, ConfigValue> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") {
        values[key] = value;
      } else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        values[key] = value as string[];
      } else {
        throw new OperationFailedError("core.config.invalid-field", { path: this.path, field: key });
      }
    }
    return values;
  }

  async write(values: ConfigValues): Promise<void> {
    const sorted = Object.fromEntries(Object.entries(values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    const temporary = `${this.path}.${process.pid}.tmp`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(temporary, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
      await rename(temporary, this.path);
    } catch (error) {
      await rm(temporary, { force: true });
      translateFsError(error, this.path);
    }
  }
}

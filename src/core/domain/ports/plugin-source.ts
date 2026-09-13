export interface PluginPackage {
  /** The file that was imported. */
  readonly location: string;
  /** From the plugin's package.json, when it has one. */
  readonly name: string | null;
  readonly version: string | null;
  /** What the file exports; the loader checks its shape. */
  readonly exports: unknown;
}

/** Finds a plugin named in the configuration and imports it. */
export interface PluginSource {
  /**
   * `entry` is a path, relative to `baseDirectory` unless absolute, or an npm package
   * name. NotFoundError when nothing is there; OperationFailedError when importing fails.
   */
  load(entry: string, baseDirectory: string): Promise<PluginPackage>;
}

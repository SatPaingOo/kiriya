export type ConfigValue = string | readonly string[];
export type ConfigValues = Readonly<Record<string, ConfigValue>>;

/** The user's configuration file: one JSON object of text and lists of text. It never holds a secret. */
export interface ConfigStore {
  /** Where the file is, whether it exists or not. */
  readonly path: string;
  exists(): Promise<boolean>;
  /**
   * Every value; empty when the file does not exist. OperationFailedError naming the
   * file when it is not one JSON object of text and lists of text.
   */
  read(): Promise<ConfigValues>;
  /** Atomically: a temporary file next to it, then a rename. */
  write(values: ConfigValues): Promise<void>;
}

export type OsFamily = "windows" | "linux" | "macos";

export interface Environment {
  readonly os: OsFamily;
  readonly homeDirectory: string;
  /** On Windows, names match in any case, as they do for programs. */
  variable(name: string): string | undefined;
  /** Every variable kiriya was started with, under the names the OS gives them. */
  variables(): Readonly<Record<string, string>>;
}

export type OsFamily = "windows" | "linux" | "macos";

export interface Environment {
  readonly os: OsFamily;
  readonly homeDirectory: string;
  variable(name: string): string | undefined;
}

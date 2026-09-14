import path from "node:path";
import type { Environment } from "../../domain/ports/environment.js";

/**
 * Where this user's configuration file lives (docs/usage.md): KIRIYA_CONFIG
 * when set; otherwise %APPDATA% on Windows, $XDG_CONFIG_HOME or ~/.config on Linux,
 * and Application Support on macOS. A relative XDG value is ignored, as the specification says.
 */
export function configFilePath(environment: Environment, cwd: string): string {
  const paths = environment.os === "windows" ? path.win32 : path.posix;
  const override = environment.variable("KIRIYA_CONFIG");
  if (override !== undefined && override !== "") return paths.resolve(cwd, override);
  const home = environment.homeDirectory;
  const absolute = (value: string | undefined): value is string => value !== undefined && paths.isAbsolute(value);
  switch (environment.os) {
    case "windows": {
      const appData = environment.variable("APPDATA");
      return paths.join(absolute(appData) ? appData : paths.join(home, "AppData", "Roaming"), "kiriya", "config.json");
    }
    case "macos":
      return paths.join(home, "Library", "Application Support", "kiriya", "config.json");
    case "linux": {
      const configHome = environment.variable("XDG_CONFIG_HOME");
      return paths.join(absolute(configHome) ? configHome : paths.join(home, ".config"), "kiriya", "config.json");
    }
  }
}

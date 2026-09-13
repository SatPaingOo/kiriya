/**
 * Folders no command may delete, move or overwrite, per OS. Windows folders are
 * named by the environment variable that holds them, since their drive varies.
 */
export const PROTECTED_PATHS = {
  windows: {
    /** Nothing inside these. */
    insideVariables: ["SystemRoot", "ProgramFiles", "ProgramFiles(x86)"],
    /** These folders themselves. */
    exactVariables: ["ProgramData", "USERPROFILE"],
    /** Relative to the drive root of the path being checked. */
    exactOnDrive: ["Users"],
  },
  posix: {
    inside: [
      "/bin",
      "/boot",
      "/dev",
      "/etc",
      "/lib",
      "/lib64",
      "/proc",
      "/sbin",
      "/sys",
      "/usr",
      "/System",
      "/Library",
    ],
    exact: ["/home", "/Users", "/opt", "/root", "/tmp", "/var"],
  },
} as const;

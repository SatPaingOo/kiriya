import path from "node:path";

/** A program in Windows' System32 folder, by full path, so nothing earlier in PATH can stand in for it. */
export function system32(program: string): string {
  return path.win32.join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", program);
}

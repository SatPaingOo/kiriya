export interface ToolDefinition {
  readonly name: string;
  /** Program names to try in order, such as python3 before python. */
  readonly programs: readonly string[];
  readonly args: readonly string[];
  /** Finds the version in what the program prints, as its first group. */
  readonly version: RegExp;
}

export const TOOLS: readonly ToolDefinition[] = [
  { name: "node", programs: ["node"], args: ["--version"], version: /\bv(\d+\.\d+\.\d+)/ },
  { name: "python", programs: ["python3", "python"], args: ["--version"], version: /\bPython (\d+\.\d+(?:\.\d+)?)/ },
  { name: "dotnet", programs: ["dotnet"], args: ["--version"], version: /^(\d+\.\d+\.\d+\S*)\s*$/m },
  { name: "java", programs: ["java"], args: ["-version"], version: /\bversion "([^"]+)"/ },
  { name: "go", programs: ["go"], args: ["version"], version: /\bgo(\d+\.\d+(?:\.\d+)?)/ },
  { name: "git", programs: ["git"], args: ["--version"], version: /\bgit version (\S+)/ },
  { name: "docker", programs: ["docker"], args: ["--version"], version: /\bDocker version ([^,\s]+)/ },
];

/**
 * The version in a tool's output, or null. A stand-in that prints no version, such as
 * the Microsoft Store's python or macOS's java without a JDK, does not count as installed.
 */
export function toolVersion(tool: ToolDefinition, output: string): string | null {
  return tool.version.exec(output)?.[1] ?? null;
}

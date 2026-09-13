/** Extension flags as given, such as ".ts,tsx" twice, as a lower-case list with dots: [".ts", ".tsx"]. */
export function parseExtensions(values: readonly string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((extension) => extension.trim())
    .filter((extension) => extension !== "")
    .map((extension) => `.${extension.replace(/^[.]/, "")}`.toLowerCase());
}

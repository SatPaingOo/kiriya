/** What the npm package must contain, and what must never leave the repository in it. */

const REQUIRED = ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "dist/src/main.js"] as const;

const FORBIDDEN_FOLDERS = [
  "dist/tests/",
  "dist/tools/",
  "src/",
  "tests/",
  "tools/",
  "spike/",
  "node_modules/",
  ".github/",
];

function forbidden(file: string): boolean {
  if (FORBIDDEN_FOLDERS.some((folder) => file.startsWith(folder))) return true;
  return file.endsWith(".map") || (file.endsWith(".ts") && !file.endsWith(".d.ts"));
}

/** Problems with the files `npm pack` would publish, one sentence each; none when the package is right. */
export function packageProblems(files: readonly string[]): string[] {
  const present = new Set(files);
  return [
    ...REQUIRED.filter((file) => !present.has(file)).map((file) => `missing: ${file}`),
    ...files.filter(forbidden).map((file) => `must not be published: ${file}`),
  ];
}

/** Dependency, build and cache folders. Globs and walks skip them unless --all is given. */
export const DEPENDENCY_DIRECTORIES: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  ".venv",
  "venv",
  "site-packages",
  "dist",
  "build",
  ".next",
  "obj",
  "bin",
  "__pycache__",
  ".pytest_cache",
]);

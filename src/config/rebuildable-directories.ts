/** Folders `files size` reports as rebuildable: dependencies, build output, caches and downloaded models. */
export const REBUILDABLE_DIRECTORIES: ReadonlySet<string> = new Set([
  "node_modules",
  ".venv",
  "venv",
  "bin",
  "obj",
  "dist",
  "build",
  ".next",
  ".turbo",
  "__pycache__",
  ".pytest_cache",
  ".ruff_cache",
  ".hf_cache",
  "models",
  "storage",
  ".gradle",
]);

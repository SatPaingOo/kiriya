import type { MessageKey } from "../i18n/locales/en.js";

export interface CleanRule {
  /** Folder names this rule may remove. */
  readonly directories: readonly string[];
  /** A sibling whose name matches shows the project that recreates them; null means anywhere. */
  readonly sibling: RegExp | null;
  /** What recreates them, for the listing. */
  readonly reason: MessageKey;
}

/**
 * Rebuildable folders, removed only next to the project file that recreates them,
 * so a hand-written `bin` or `build` folder elsewhere is never touched.
 */
export const CLEAN_RULES: readonly CleanRule[] = [
  {
    directories: [
      "node_modules",
      ".next",
      ".nuxt",
      ".turbo",
      ".svelte-kit",
      ".parcel-cache",
      "dist",
      "build",
      "coverage",
    ],
    sibling: /^package\.json$/,
    reason: "files.clean.reason.node",
  },
  { directories: ["bin", "obj"], sibling: /\.(cs|fs|vb)proj$/i, reason: "files.clean.reason.dotnet" },
  {
    directories: [".venv", "venv"],
    sibling: /^(pyproject\.toml|requirements\.txt|setup\.py)$/,
    reason: "files.clean.reason.python",
  },
  { directories: ["target"], sibling: /^(Cargo\.toml|pom\.xml)$/, reason: "files.clean.reason.cargo-maven" },
  {
    directories: [".gradle", "build"],
    sibling: /^(build\.gradle|build\.gradle\.kts|settings\.gradle)$/,
    reason: "files.clean.reason.gradle",
  },
  {
    directories: ["__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache"],
    sibling: null,
    reason: "files.clean.reason.python-cache",
  },
];

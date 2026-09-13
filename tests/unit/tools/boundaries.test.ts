import assert from "node:assert/strict";
import { test } from "node:test";
import { findViolations } from "../../../tools/boundaries.js";

test("allowed imports pass", () => {
  const violations = findViolations([
    { path: "main.ts", text: 'import { readFileSync } from "node:fs";\nimport { en } from "./i18n/locales/en.js";' },
    { path: "core/domain/command.ts", text: 'import type { MessageKey } from "../../i18n/locales/en.js";' },
    {
      path: "modules/files/application/walk.ts",
      text: [
        'import path from "node:path";',
        'import { DEPENDENCY_DIRECTORIES } from "../../../config/dependency-directories.js";',
        "import {",
        "  type Catalog,",
        "  type MessageKey,",
        '} from "../../../i18n/locales/en.js";',
        'import { UsageError } from "../../../core/domain/errors.js";',
      ].join("\n"),
    },
    {
      path: "modules/files/presentation/list.view.ts",
      text: 'import type { ListOutput } from "../application/list.js";',
    },
    { path: "modules/files/files.module.ts", text: 'import { ListEntries } from "./application/list.js";' },
    { path: "config/modules.ts", text: 'import { filesModule } from "../modules/files/files.module.js";' },
    { path: "core/infrastructure/node/fs.ts", text: 'import { rm } from "node:fs/promises";' },
  ]);
  assert.deepEqual(violations, []);
});

test("each broken rule is reported with its file and line", () => {
  const violations = findViolations([
    { path: "modules/files/application/a.ts", text: '\nimport { x } from "../../git/domain/x.js";' },
    { path: "modules/files/domain/b.ts", text: 'import { readFile } from "node:fs/promises";' },
    { path: "core/application/c.ts", text: 'import { NodeFileSystemAdapter } from "../infrastructure/node/fs.js";' },
    { path: "core/application/d.ts", text: 'import { readFile } from "node:fs/promises";' },
    { path: "core/presentation/e.ts", text: 'import chalk from "chalk";' },
    { path: "core/application/f.ts", text: 'import { en } from "../../i18n/locales/en.js";' },
    { path: "core/domain/g.ts", text: 'const os = await import("node:os");' },
    { path: "core/domain/h.ts", text: 'import { filesModule } from "../../modules/files/files.module.js";' },
    { path: "modules/files/domain/i.ts", text: 'import { x } from "../../../../tests/x.js";' },
  ]);
  assert.deepEqual(
    violations.map((violation) => [violation.file, violation.line]),
    [
      ["modules/files/application/a.ts", 2],
      ["modules/files/domain/b.ts", 1],
      ["core/application/c.ts", 1],
      ["core/application/d.ts", 1],
      ["core/presentation/e.ts", 1],
      ["core/application/f.ts", 1],
      ["core/domain/g.ts", 1],
      ["core/domain/h.ts", 1],
      ["modules/files/domain/i.ts", 1],
    ],
  );
});

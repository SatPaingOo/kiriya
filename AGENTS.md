# AGENTS.md

Instructions for AI coding agents working in this repository. The rules are the same ones
people follow in [CONTRIBUTING.md](CONTRIBUTING.md) and [the architecture](docs/development/architecture.md);
this file puts them in one place.

## The project

kiriya is one command-line toolbox for everyday developer work that behaves the same on
Windows, Linux and macOS. It is written in TypeScript for Node.js 22.13 or later, as ES
modules, with no runtime dependencies.

## Commands

| Task | Command |
|---|---|
| Install | `npm ci` |
| Build | `npm run build` |
| Build, check import boundaries, run all tests | `npm test` |
| Lint, format, types | `npm run lint`, `npm run format:check`, `npm run typecheck` |
| Try the CLI | `node dist/src/main.js files find --ext .ts` |
| Write the generated parts of the docs | `npm run docs` |

A change is done only when all of these pass. Report failures as they are; do not skip,
weaken or delete a test to make it pass.

## Rules

1. **Layers.** `domain` imports only `domain`. `application` adds `config` data and
   `node:path`. `infrastructure` holds adapters. `presentation` holds argv, help, views
   and JSON. A module never imports another module. `npm test` checks this.
2. **Use cases do not print or reach the system directly.** No `console`, `process`,
   `node:fs` or `node:child_process` in a use case; take ports through the constructor.
3. **Only `src/main.ts` wires adapters** and checks the operating system to choose one.
   Platform code lives in `src/core/infrastructure/platform/<os>/`.
4. **Messages are catalog keys.** Every user-facing string goes in
   `src/i18n/locales/en.ts`. Pass `message(key, params)`, never finished text, because
   JSON output and future translations depend on keys.
5. **Every command works with `--json`.** Return data in the `CommandResult`; only
   presentation writes to stdout and stderr.
6. **Safety.** Declare `spec.safety` honestly. `destroy` needs a typed confirmation, and
   `--yes` never counts for it. Check targets of a delete or move with `ProtectedPaths`.
   Never replace something that exists without an explicit flag.
7. **Same result on every OS.** Use `node:path` and `context.cwd`, sort by code point,
   expand globs through the files module, start programs with an argument array through
   `runProgram` and never through a shell string, and store times as whole milliseconds.
8. **Tests with every change.** Unit tests for pure logic; integration tests in temporary
   folders from `tests/support/fakes.ts`; a contract test per adapter; an end-to-end test
   for CLI behaviour. Never touch real user folders. The real trash is used only when
   `KIRIYA_TEST_REAL_TRASH=1`.
9. **No new dependencies**, runtime or development, unless a maintainer asks for one.
10. **Docs follow code.** A change to a command updates its guide in `docs/modules/` and runs
    `npm run docs`. Update `docs/development/architecture.md` when the structure changes and
    `docs/development/design.md` when a decision changes.
11. **Commits** follow Conventional Commits and carry the human author only, with no
    co-author or "generated with" trailers. Commit or push only when a maintainer asks.
12. **Never commit** `dist/`, `node_modules/`, local test output, secrets, or folders of
    coding agents.

## Adding a command, briefly

Catalog keys in `en.ts` → `modules/<m>/application/<verb>-<noun>.use-case.ts` with its
spec → `modules/<m>/presentation/<verb>.view.ts` → register both in `<m>.module.ts` →
tests → `npm run docs`. [The architecture](docs/development/architecture.md#extending-kiriya)
has the details.

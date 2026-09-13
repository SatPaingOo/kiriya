# Contributing

kiriya is in early development. This guide covers the local setup, the checks every
change must pass, and how work flows into `main`. Read [ARCHITECTURE.md](./ARCHITECTURE.md)
before changing code, and [BLUEPRINT.md](./BLUEPRINT.md) section 7 for the code standards.

Contributions are licensed under the [MIT License](./LICENSE), and everyone taking part
follows the [code of conduct](./CODE_OF_CONDUCT.md). Report a security problem privately,
as [SECURITY.md](./SECURITY.md) describes, never in a public issue.

## Setup

You need Node.js 22.13 or later and npm; `nvm use` picks the version in `.nvmrc`.

```bash
npm ci
npm run build
node dist/src/main.js files list
```

## Scripts

| Script | What it does |
|---|---|
| `npm run build` | Cleans `dist/`, then compiles `src/`, `tests/` and `tools/` |
| `npm test` | Builds, checks import boundaries, and runs every test |
| `npm run lint` | ESLint |
| `npm run format` | Formats with Prettier; `npm run format:check` only checks |
| `npm run typecheck` | Type-checks without writing files |
| `npm run dev` | Recompiles on every change |

Run one test file after a build with `node --test dist/tests/unit/files/glob.test.js`.

### Tests that use the real trash

`tests/contract/trash.contract.test.ts` sends two small files to your operating system's
trash, so it is skipped unless you ask for it:

```bash
KIRIYA_TEST_REAL_TRASH=1 npm test
```

In PowerShell, set `$env:KIRIYA_TEST_REAL_TRASH = "1"` first. CI always runs it.

### Tests that need programs

The `git` integration tests create real repositories and need git on PATH; without it
they are skipped. The `docker` tests use a fake engine, so Docker is not needed to run
them. No test reads your own kiriya configuration: the end-to-end runner points
`KIRIYA_CONFIG` at a file that does not exist.

## Before you open a pull request

- `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test` pass.
- New behaviour has tests: unit tests for pure logic, integration tests in temporary
  folders, a contract test for a new adapter, an end-to-end test for a CLI change.
- Every refusal has a negative test: protected paths, declined confirmations, conflicts.
- Every new user-facing string is a key in `src/i18n/locales/en.ts`.
- No new dependency, runtime or development, without agreement in an issue first.
- `ARCHITECTURE.md` changes with the structure; `BLUEPRINT.md` changes with a decision.

## Branches and commits

- Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `test/<topic>`, `ci/<topic>`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat: add files copy`, `fix: keep BOM when replacing text`. Use the imperative, lower case, no final period.
- Commits carry their human author only: no co-author or "generated with" trailers for tools.
- Keep a pull request to one concern. Squash fixups before merging.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`:

| Job | Runs on |
|---|---|
| `quality`: lint, format, types | Linux, Node 22 |
| `test`: build, boundaries, all tests, including the real trash | Public repository: Windows, Linux and macOS, each on Node 22, 24 and the current release. Private repository: Linux and Windows on Node 22 |

A private repository has limited CI minutes, and macOS minutes cost about ten times Linux
ones, so there the full matrix runs only when started by hand from the Actions tab with
`full` checked. Do that before merging anything that touches an adapter, paths, or processes.

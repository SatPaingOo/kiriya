# Changelog

Notable changes to kiriya, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[semantic versioning](https://semver.org/). Command ids, flags, exit codes and JSON
output shapes are kiriya's public API.

## [Unreleased]

### Changed

- An option that takes one of a list of values now declares that list, so an MCP tool
  offers it as a JSON Schema `enum` instead of naming it only in prose an agent would have
  to read. Eleven options gained one: `files list --sort`, `files find --type`,
  `files hash --algo`, `files info --hash`, `files rename --case` and `--only`,
  `convert case --to`, `convert time --unit`, `gen token --format` and `net dns --type`.
  Help and the generated reference are unchanged, since a declared list names itself.
- Tab completion reads the same list, rather than parsing the value name it was displayed
  under. `docker logs --tail <n|all>` therefore offers nothing instead of offering `n`,
  which was never a value it took.

## [0.1.1] - 2026-09-24

### Changed

- A usage error inside a command that was found now points at that command's help, so
  `Missing argument: sources` is followed by `Run kiriya files copy --help to see what it
  takes.` A spelling suggestion, being the more useful hint, still takes precedence.
- `kiriya help <module>` lists each command's option names under it, so a module's whole
  surface can be read at once instead of one command at a time. The short forms, the
  values and the descriptions stay in the command's own help. The readme now shows the
  three steps help goes through, which nothing pointed out before.

### Fixed

- The readme and the getting started page said kiriya was not on npm and walked people
  through building it from source. Both now install it with `npm install --global kiriya`.
  Since npm keeps the readme it was given at publish time, 0.1.0's page carried the wrong
  instructions until this release replaced them.

## [0.1.0] - 2026-09-23

The first release.

### Added

- Core: `--json` on every command, message keys for every string, typed errors
  mapped to exit codes (2 for usage, 130 for an interruption, 1 otherwise), a typed
  confirmation for work that cannot be undone, protected paths, and plugins named in
  the configuration file.
- `files`: new, list, tree, info, read, find, grep, hash, dupes, compare, copy, move,
  rename, replace, delete (to the trash unless `--permanent`), clean, sync and size.
- `archive`: zip and unzip; tar and untar for `.tar.gz`, `.tgz` and `.tar`. Extraction
  refuses any archive with an entry that would land outside the target folder.
- `git`: status, fetch, pull and switch across every repository under a folder.
- `docker`: ps, up, down, logs, rebuild and clean for the compose project in a folder.
- `config`: path, keys, list, get, set and unset. The file never holds a secret.
- `doctor`: what the machine gives kiriya: runtime, configuration, trash, clipboard,
  git, docker and plugins.
- `gen`: uuid (version 4 or 7), ulid, password and token.
- `convert`: base64, hex, url, json, jwt (decoded only, never verified or sent),
  time and case.
- `env`: show, with secret-looking values hidden; path; and check of `.env` against
  `.env.example`.
- `sys`: info, tools and report.
- `net`: ip, check and dns.
- `port`: who, kill and free.
- `proc`: list, find, kill and tree.
- `clip`: copy and paste, with Unicode intact.
- `open`: a file, folder or web address, never running a program.
- `completion`: tab completion for bash, zsh, fish and PowerShell.
- `wait`: port, url and file. Wait until a TCP port accepts connections, or stops with `--gone`;
  until a web address answers with a 2xx status, or one `--status` names; or until a file
  appears, or goes with `--gone`. It tries every half second until `--timeout`, 60 seconds by
  default, and exits with 1 when the time runs out.
- `mcp`: `kiriya mcp` serves every command that changes nothing to AI agents as MCP
  tools over stdio, for the 2026-07-28 protocol and for clients that still open with
  `initialize`. Paths must stay inside the `--root` folders, symlinks included. With
  `kiriya config set mcp.allowWrite true`, commands that change files in ways that can be
  undone are offered too, and with `mcp.allowDestroy true`, commands whose work cannot be
  undone, to clients that support elicitation: each asks the user before it changes
  anything. `config set`, `config unset`, `docker up` and `docker rebuild` are never offered.
  `open`, `clip paste`, `proc list --full` and `wait url` need `mcp.allowWrite`, and no tool that
  changes something may reach inside a `.git` folder. `kiriya mcp` also takes its folders
  as arguments, and each release carries an MCP bundle for Claude's desktop app.
- Help and docs: `kiriya help <module>` explains what a module is for, shows examples and
  points to its guide. Every module has a guide in `docs/modules/` with a command reference
  written from the commands themselves, and CI fails when the docs and the CLI disagree.
  Plugins may add `about`, `examples` and `guide` to their own help.

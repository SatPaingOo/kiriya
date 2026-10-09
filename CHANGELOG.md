# Changelog

Notable changes to kiriya, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[semantic versioning](https://semver.org/). Command ids, flags, exit codes and JSON
output shapes are kiriya's public API.

## [Unreleased]

### Fixed

- An argument named after one of JavaScript's own members disappeared. `constructor`,
  `toString`, `toLocaleString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`,
  `propertyIsEnumerable` and `__proto__` were looked up in a plain object of the global flags,
  which answers every one of them with a function rather than with nothing, so each was taken
  for a global flag and removed from the command line. `kiriya files grep toString .` therefore
  searched for `.`, found it, printed matches and exited 0 — **a wrong answer presented as a
  right one**, which is worse than an error. `kiriya convert base64 constructor` encoded
  nothing, and any option given one of those names as its value reported that the option
  needed a value. The lookup is now a `Map`, which has no inherited names to confuse with real
  ones.

  The same mistake is fixed in two more places it had not yet been reached in. `process.env`
  answers those names with a function too, so `env path constructor` would have thrown on
  text that was not text as soon as the argument survived; it now reads as unset. A plugin's
  message catalog and its placeholders are looked up the same way, where `constructor` as a
  key threw and as a placeholder printed JavaScript source into a message.

- `self-update --apply` could never install anything on Windows. kiriya opens no shell, so it
  starts only real executables, and Windows has no `npm.exe`: npm arrives as `npm.cmd` and
  `npm.ps1`, which are a batch file and a PowerShell script. `--apply` therefore reported that
  npm was not on PATH on every Windows machine, while `self-update` without it worked and said
  an upgrade was available. npm itself is plain JavaScript, so kiriya now looks for
  `node_modules/npm/bin/npm-cli.js` beside node and then under `lib`, and starts it with the
  node already running kiriya. An `npm` that is a real executable on PATH still comes first, so
  Linux and macOS behave exactly as before.

  **Upgrading to this from 0.2.0 on Windows has to be done by hand**, with
  `npm install --global kiriya`, because the broken `--apply` is the one in 0.2.0. From this
  version on it works.

## [0.2.0] - 2026-10-04

### Added

- `secrets scan` finds secrets committed into a folder's files: a token whose issuer gives it
  a recognisable prefix, a PEM private key, a password inside a URL, or a JWT. It exits 1 when
  anything is found, so a git hook or a CI step needs no output parsing. **A finding never
  carries the secret** — `ghp_****`, `postgres://me:****@` — because a report that quoted the
  value would copy it into scrollback and CI logs. Unlike every other command it reads hidden
  files by default, since `.env` and `.npmrc` are where secrets sit, and it skips dependency
  folders instead; `--all` scans those too. A line saying `kiriya:allow-secret`, on it or above
  it, declares one deliberate, which is how test fixtures and documentation stay quiet.
  Over MCP it needs `mcp.allowWrite`, as `clip paste` does.

  It deliberately does not flag a line that merely assigns something named like a secret.
  That rule serves `env show`, where the name and the value are already separate, and over
  source code it is useless: against kiriya itself it matched 42 lines and every one was
  syntax, such as `if (token === "--")` in the argv parser.

## [0.1.3] - 2026-10-03

### Added

- `self-update` asks npm's registry whether a newer kiriya exists, and installs it with
  `--apply`. Without `--apply` nothing changes, so it is safe to run just to find out.
  It names the exact version the registry answered with rather than `latest`, never offers
  a prerelease, and refuses to run npm over an install npm did not make, such as a source
  checkout or a future Homebrew tap. It is never offered to AI agents: an agent must not
  upgrade, mid-session, the tool it is calling.
- `doctor` ends with a line naming `self-update`. It still reaches no network itself —
  until now nothing told anyone that a newer version existed at all.

## [0.1.2] - 2026-09-24

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

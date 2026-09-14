# Usage

What every kiriya command has in common. [Modules](modules/README.md) describes the
commands themselves.

## Commands

```text
kiriya <module> <command> [arguments] [options]
```

- A module groups related commands, such as `files`, `git` or `port`. A module that is a
  single command runs by its own name: `kiriya doctor`, `kiriya open <target>`,
  `kiriya completion <shell>`.
- Options can come before or after arguments. A value follows its option after a space or
  `=`: `--depth 3` or `--depth=3`. Options that switch something on take no value.
- `--` ends the options: every word after it is an argument, even one that starts with `-`.
- A misspelt module, command or option is a usage error that suggests the closest name:

  ```text
  Unknown option: --al
  Did you mean --all?
  ```

## Help

| To see | Run |
|---|---|
| Every module and the global options | `kiriya --help`, `kiriya -h`, or `kiriya` alone |
| What a module is for, its commands and examples, and its guide | `kiriya help <module>`, or `kiriya <module>` |
| A command's usage, arguments, options and examples | `kiriya help <module> <command>`, or `kiriya <module> <command> --help` |
| The MCP server's arguments | `kiriya mcp --help` |
| The version | `kiriya --version` or `kiriya -V` |

## Global options

Every command takes these, anywhere before `--`.

<!-- kiriya:global-options -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

| Option | Description |
|---|---|
| `--json` | Print the result as JSON on stdout. |
| `--no-color` | Print without colour. |
| `--no-input` | Never prompt; fail with the flag that would have been needed. |
| `--debug` | Show internal details of unexpected errors. |
| `-h, --help` | Show help. |
| `-V, --version` | Show the version. |
<!-- /kiriya:global-options -->

## Output

A command prints its result as text on stdout. Warnings, failures, progress and questions
go to stderr, so `kiriya files find --ext .log > found.txt` saves only the results.

Colour appears only on a terminal, unless `FORCE_COLOR` is set. `--no-color`,
`KIRIYA_NO_COLOR`, `NO_COLOR`, `NODE_DISABLE_COLORS` and `TERM=dumb` turn it off.

## JSON output

With `--json`, every command prints exactly one JSON document on stdout:

```json
{
  "ok": true,
  "command": "port.who",
  "kind": "done",
  "data": {},
  "warnings": [],
  "failures": []
}
```

| Field | Meaning |
|---|---|
| `ok` | `false` when anything failed |
| `command` | The command's id, `<module>.<command>` |
| `kind` | `done`, or `preview` when a command only showed its plan; a preview adds `applyFlag`, the option that makes the change |
| `data` | The command's result. Its shape is part of kiriya's public API, so a field is never renamed or removed without a major version |
| `warnings`, `failures` | Messages, each with a stable `key`, its `params`, and the English `text` |

An error prints a document of its own:

```json
{
  "ok": false,
  "error": {
    "kind": "not-found",
    "message": { "key": "core.fs.not-found", "params": { "path": "missing.txt" }, "text": "Not found: missing.txt" }
  }
}
```

The error kinds are `usage`, `not-found`, `conflict`, `refused`, `capability-unavailable`,
`failed`, `interrupted` and `unexpected`. Scripts should match on `kind` and `key`, never on
`text`, whose wording may change or be translated.

Questions still go to stderr with `--json`, and so does the live output of a program kiriya
runs, such as `docker compose`, so stdout stays one document.

## Exit codes

| Code | Means |
|---|---|
| `0` | Done |
| `1` | Something failed or was refused: a path was not found, a confirmation was declined, something the command needs is missing, or part of the work failed, such as a repository `git pull` could not update. `files compare` and `files hash --check` also exit with 1 when they find a difference |
| `2` | A usage error: an unknown option, a missing argument, or a value the command cannot use |
| `130` | Interrupted with Ctrl+C |

`--debug` adds the stack trace of an unexpected error, which helps in a bug report.

## Safety

Every command declares the most it can do, and each module guide's reference shows it:

| Level | Means |
|---|---|
| `read` | Changes nothing |
| `write` | Changes things in ways that can be undone, such as creating, moving, renaming or sending to the trash |
| `destroy` | Can do work that cannot be undone. That work always needs a typed confirmation |

### Previews

Commands that change many things at once show their plan first:

- `files rename`, `files replace`, `files clean`, `files sync` and `docker clean` change
  nothing without `--apply`.
- `files copy`, `files move` and `files delete` show their plan with `--dry-run`.

### Questions and typed confirmations

Work that can be undone may ask a yes-or-no question, such as
`Switch 4 repositories to main? [y/N]`. `--yes` answers it in advance.

Work that cannot be undone, such as `files delete --permanent`, `port kill`, or replacing a
file that exists, asks you to type what it will affect: a count, a port number or a name.
`--yes` never answers it. In a script, pass the value you expect with `--confirm`:

```bash
kiriya files delete old-logs --permanent --confirm=1
```

When the value does not match what kiriya found, the command stops before it changes
anything.

Without a terminal, or with `--no-input`, kiriya never asks. A question without `--yes`, or a
typed confirmation without `--confirm`, stops the command with exit code 1, and the message
names the option that was needed.

### The trash

`files delete` sends files and folders to the operating system's trash: the Recycle Bin on
Windows, the trash of the freedesktop.org specification on Linux, and the Trash on macOS.
`--permanent` removes them for good instead. Before macOS 15, kiriya moves items into the
Trash itself, so Finder's Put Back does not work for them.

### Protected paths

No command deletes, moves or overwrites these, whatever it is told:

- a drive root, such as `C:\` or `/`;
- your home folder;
- the working folder, or any folder above it;
- operating-system folders:

  | OS | Nothing inside | These folders themselves |
  |---|---|---|
  | Windows | `%SystemRoot%`, `%ProgramFiles%`, `%ProgramFiles(x86)%` | `%ProgramData%`, `%USERPROFILE%`, `\Users` |
  | Linux and macOS | `/bin`, `/boot`, `/dev`, `/etc`, `/lib`, `/lib64`, `/proc`, `/sbin`, `/sys`, `/usr`, `/System`, `/Library` | `/home`, `/Users`, `/opt`, `/root`, `/tmp`, `/var` |

## Paths and globs

Relative paths start at the current folder. kiriya expands globs itself, so a pattern means
the same in PowerShell, cmd, bash and zsh. Quote it, so your shell passes it on unchanged:

```bash
kiriya files delete "logs/*.log"
```

| Pattern | Matches |
|---|---|
| `*` | Any characters within one folder or file name |
| `?` | Exactly one character |
| `**` | Any number of folders |
| `[abc]`, `[!abc]` | One of these characters, or one character that is not |
| `{ts,tsx}` | Either alternative |

- Use `/` between folders in a glob, on every OS.
- Globs ignore case on every OS.
- Globs and folder searches skip hidden entries, whose names start with `.`, and these
  dependency and build folders: `node_modules`, `.git`, `.venv`, `venv`, `site-packages`,
  `dist`, `build`, `.next`, `obj`, `bin`, `__pycache__` and `.pytest_cache`. `--all`
  includes them.
- A name kiriya creates must be valid on Windows, Linux and macOS alike, so a name such as
  `CON` or `report?.txt` is refused on every OS.

## Piped input

Commands that take text, such as `convert` and `clip copy`, read it from an argument, from
what is piped in, or from a file with `--file`. With no argument, or `-`, they read what is
piped in:

```bash
git log -1 | kiriya clip copy
kiriya convert base64 --decode < encoded.txt
```

## Configuration

kiriya reads one JSON file of settings per user. `kiriya config path` prints where it is:

| Windows | Linux | macOS |
|---|---|---|
| `%APPDATA%\kiriya\config.json` | `$XDG_CONFIG_HOME/kiriya/config.json`, by default `~/.config/kiriya/config.json` | `~/Library/Application Support/kiriya/config.json` |

`KIRIYA_CONFIG` names another file. Change settings with `kiriya config set` and
`kiriya config unset`; the [config guide](modules/config.md) shows how.

<!-- kiriya:settings -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

| Setting | Takes | Description | Example |
|---|---|---|---|
| `mcp.allowDestroy` | `true` or `false` | true lets kiriya mcp offer AI agents the commands whose work cannot be undone, each of which asks the user through the client first; start the server again after changing it. | `kiriya config set mcp.allowDestroy true` |
| `mcp.allowWrite` | `true` or `false` | true lets kiriya mcp offer AI agents the commands that change files, which can be undone; start the server again after changing it. | `kiriya config set mcp.allowWrite true` |
| `plugins` | a list of values | Plugins to load: npm package names, or paths relative to this file. | `kiriya config set plugins kiriya-plugin-example ./team/kiriya-plugin` |
<!-- /kiriya:settings -->

- The file never holds a secret: `kiriya config set` refuses a value that looks like one.
- A file that is not valid is reported with its path and the field at fault. Until it is
  fixed, no plugin loads, every built-in command still works, and `kiriya doctor` shows the
  problem.
- There is no project configuration file, so a cloned repository can never change what
  kiriya loads.

## Environment variables

| Variable | Effect |
|---|---|
| `KIRIYA_CONFIG` | The configuration file to use instead of the default one |
| `KIRIYA_NO_COLOR` | Any value turns colour off |
| `NO_COLOR`, `NODE_DISABLE_COLORS` | Turn colour off, as they do for other programs |
| `FORCE_COLOR` | Turns colour on, even when the output is not a terminal |
| `TERM=dumb` | Turns colour off |

## Plugins and AI agents

- [Plugins](guides/plugins.md) add modules that follow every rule on this page.
- [kiriya mcp](guides/mcp.md) serves the same commands to AI agents, with settings that decide
  what they may change.

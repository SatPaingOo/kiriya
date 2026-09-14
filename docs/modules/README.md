# Modules

kiriya groups its commands into modules: `kiriya <module> <command>`. Each module below
has a guide with the tasks it is for and a reference of every command, written from the
commands themselves so it always matches the CLI.

<!-- kiriya:modules -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

| Module | What it does | Commands |
|---|---|---|
| [`archive`](archive.md) | ZIP and tar.gz archives, made and opened the same way on every OS with no zip, tar or 7-Zip installed. | `tar` `untar` `unzip` `zip` |
| [`clip`](clip.md) | Copy text to the clipboard and paste it back, with Unicode intact on every OS. | `copy` `paste` |
| [`completion`](completion.md) | Tab completion for kiriya's modules, commands, options and values in bash, zsh, fish and PowerShell. | `kiriya completion` `suggest` |
| [`config`](config.md) | kiriya's own settings, such as the plugins to load, in one file per user. | `get` `keys` `list` `path` `set` `unset` |
| [`convert`](convert.md) | Convert text between base64, hex, URL encoding, JSON, JWT, times and cases, entirely on this machine. | `base64` `case` `hex` `json` `jwt` `time` `url` |
| [`docker`](docker.md) | docker compose for the project in the current folder, and a previewed clean-up of the engine. | `clean` `down` `logs` `ps` `rebuild` `up` |
| [`doctor`](doctor.md) | Check what this machine gives kiriya: runtime, configuration, trash, clipboard, git, docker and plugins. | `kiriya doctor` |
| [`env`](env.md) | Environment variables, PATH and .env files, read the same way on every OS. | `check` `path` `show` |
| [`files`](files.md) | Files and folders: create, find, read, search, compare, copy, move, rename and delete, the same on every OS. | `clean` `compare` `copy` `delete` `dupes` `find` `grep` `hash` `info` `list` `move` `new` `read` `rename` `replace` `size` `sync` `tree` |
| [`gen`](gen.md) | Random identifiers, passwords and tokens from the operating system's secure random source. | `password` `token` `ulid` `uuid` |
| [`git`](git.md) | Git across every repository under a folder: status, fetch, pull and switch. | `fetch` `pull` `status` `switch` |
| [`net`](net.md) | Local addresses, TCP reachability and DNS lookups, the same on every OS. | `check` `dns` `ip` |
| [`open`](open.md) | Open a file or folder in its default application, or a web address in the browser. | `kiriya open` |
| [`port`](port.md) | See which process listens on a TCP port, end it, or find a free port, the same on every OS. | `free` `kill` `who` |
| [`proc`](proc.md) | List, find and end processes, and show them as a tree, the same on every OS. | `find` `kill` `list` `tree` |
| [`sys`](sys.md) | This machine and the developer tools on it, described the same way on every OS. | `info` `report` `tools` |
| [`wait`](wait.md) | Wait until a port listens, a web address answers or a file appears, the same way on every OS. | `file` `port` `url` |
<!-- /kiriya:modules -->

In the terminal, `kiriya --help` lists the modules, and `kiriya help <module>` explains one
with its commands, examples and the address of its guide.

## Safety at a glance

Every command declares the most it can do. Each guide's reference shows the level:

| Level | Means | For example |
|---|---|---|
| `read` | Changes nothing | `files find`, `port who`, `git status` |
| `write` | Changes things in ways that can be undone | `files move`, `files rename`, `git switch` |
| `destroy` | Can do work that cannot be undone, which always needs a typed confirmation | `files delete --permanent`, `port kill`, `docker down --volumes` |

[Usage](../usage.md#safety) explains previews, confirmations, the trash and the paths
kiriya never touches.

## More modules

A plugin adds a module of its own, with the same help, JSON output and safety rules.
[Plugins](../guides/plugins.md) shows how to install one and how to write one.

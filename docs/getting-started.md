# Getting started

This page installs kiriya, checks what your machine offers it, and walks through the
commands most people try first. It takes about five minutes.

## Requirements

- [Node.js](https://nodejs.org/) 22.13 or later. `node --version` shows yours.
- Windows, Linux or macOS.
- git, to install from source.

## Install

kiriya is not published to npm yet. Until its first release, build it from source:

```bash
git clone https://github.com/SatPaingOo/kiriya.git
cd kiriya
npm ci
npm run build
npm link
```

`npm link` puts the `kiriya` command on your PATH. Check that it answers:

```bash
kiriya --version
```

After the first release, `npm install --global kiriya` replaces these steps.

## Check your machine

```bash
kiriya doctor
```

`doctor` checks what kiriya relies on: the Node.js version, the configuration file, the
trash, the clipboard, git, docker and plugins. `warn` marks something only some commands
need, such as docker for the `docker` module, and `fail` marks a problem to fix. The
[doctor guide](modules/doctor.md) explains each check.

## Find your way around

```bash
kiriya --help
kiriya help files
kiriya help files find
```

`kiriya --help` lists every module. `kiriya help <module>` explains a module, with its
commands, examples and the address of its guide, and `kiriya help <module> <command>` shows
one command's arguments and options. [Modules](modules/README.md) has the same guides here.

## First commands

These change nothing, so they are safe to try in any folder:

```bash
kiriya files tree --depth 2
kiriya files find --name "*.md"
kiriya files grep TODO
kiriya port who
kiriya sys info
kiriya gen uuid
```

Quote globs such as `"*.md"`: kiriya expands them itself, the same way in every shell.

## Get JSON

Every command prints its result as one JSON document with `--json`, for scripts and other
programs:

```bash
kiriya port who 3000 --json
```

[Usage](usage.md#json-output) describes the document.

## Change things safely

kiriya shows a plan before changing many files, sends deletions to the trash, and asks you
to type a confirmation before anything that cannot be undone. Try it in a scratch folder:

```bash
kiriya files new scratch/notes.md scratch/old.log
kiriya files rename "scratch/*" --find old --with archived
kiriya files rename "scratch/*" --find old --with archived --apply
kiriya files delete scratch
```

- The first `rename` only shows its plan; `--apply` renames.
- `delete` asks first, then sends the folder to the trash, where you can restore it.
- `kiriya files delete scratch --permanent` would ask you to type how many items it removes,
  because that cannot be undone.

[Usage](usage.md#safety) explains previews, confirmations and the paths kiriya never
touches.

## Turn on tab completion

Add one line to your shell's profile to complete modules, commands and options with Tab.
[Tab completion](guides/completion.md) shows the line for bash, zsh, fish and PowerShell.

## Next steps

- [Usage](usage.md): global options, output, exit codes, safety, globs and configuration.
- [Modules](modules/README.md): a guide to each module.
- [MCP server](guides/mcp.md): let AI agents use kiriya under the same rules.
- [Plugins](guides/plugins.md): add modules of your own.

## Uninstall

```bash
npm unlink --global kiriya
```

The only other thing kiriya may leave behind is its configuration file, if you created one;
`kiriya config path` shows where it is.

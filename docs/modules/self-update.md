# self-update

Asks npm's registry whether a newer kiriya exists, and installs it when told to.

```bash
kiriya self-update              # ask, and say where you stand
kiriya self-update --apply      # ask, then install the newer version
```

## Find out whether you are behind

```bash
kiriya self-update
```

It prints one of two things:

```text
kiriya 0.1.2 is the newest version
```

```text
kiriya 0.2.0 is out; this is 0.1.2
Run kiriya self-update --apply to install it.
```

Nothing is installed and nothing on the machine changes. Run it as often as you like.

## Install the newer version

```bash
kiriya self-update --apply
```

This runs `npm install --global kiriya@<version>`, naming the exact version the registry
answered with rather than `latest`, so what gets installed is what you were just shown.
npm's own output appears as it goes, because an install over a slow network takes a while.

When there is nothing newer, `--apply` does nothing at all.

### How npm is started

kiriya opens no shell, which decides how it finds npm:

1. **`npm` on PATH**, when what is there is a program that can be started on its own. That is
   the usual answer on Linux and macOS, and it comes first so a machine with a particular npm
   on its PATH gets that one.
2. **npm's own script, started with the node already running kiriya.** On Windows PATH holds
   `npm.cmd` and `npm.ps1`, which are a batch file and a PowerShell script: both need a shell,
   and there is no `npm.exe` at all. npm itself is plain JavaScript, so kiriya looks for
   `node_modules/npm/bin/npm-cli.js` beside node and then under `lib`, which is where every
   installer, nvm, nvm-windows and fnm included, puts it.

When neither answers, `--apply` says so instead of running anything.

## Good to know

- **Nothing checks for updates by itself.** kiriya reaches the network only where a command's
  whole purpose is to, and this is the only one that does so for a reason other than the one
  you asked for — which is why you have to ask. There is no background check, no cached
  notice, and no first-run phone home.
- **`doctor` does not ask either.** It reports the version it is and prints a line saying to
  run this command, because that keeps `doctor` entirely offline.
- **It will not run npm over an install npm did not make.** If kiriya's files are not inside a
  `node_modules/kiriya` folder — a source checkout linked with `npm link`, or some future
  Homebrew tap or single file — it says which version is out and leaves the installing to
  whatever put it there.
- **A prerelease is never offered.** It compares against the version the registry serves as
  `latest`, and a prerelease sorts below the release it leads to.
- **It is never offered to AI agents.** An agent must not upgrade, mid-session, the tool it is
  calling to a version with different commands. Over MCP this command does not exist.
- **Reading the registry has a size limit.** The body is read up to 256 KB and then abandoned,
  so a proxy answering with something enormous cannot be loaded into memory. A proxy answering
  with a sign-in page is reported as not saying which version is latest, rather than guessed at.

## Exit codes

| Code | When |
|---|---|
| `0` | It said where you stand, or installed the newer version |
| `1` | The registry could not be reached or did not say, npm refused, or npm could not be found |

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya self-update`

Ask the registry whether a newer kiriya exists, and install it with --apply.

```text
kiriya self-update [options]
```

| Option | Description |
|---|---|
| `--apply` | Install the newer version; without it nothing changes. |

- **Safety:** `write`, can change things, in ways that can be undone
- **Network:** uses the network
- **MCP:** never offered to AI agents, because it is only for a person at a terminal

```bash
kiriya self-update
kiriya self-update --apply
kiriya self-update --json
```
<!-- /kiriya:reference -->

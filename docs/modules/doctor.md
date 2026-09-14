# kiriya doctor

Check what this machine gives kiriya before a command needs it.

```bash
kiriya doctor
```

```text
  ok  kiriya     0.1.0
  ok  node       v24.14.0
  ok  os         windows
  ok  config     C:\Users\you\AppData\Roaming\kiriya\config.json (not created yet)
  ok  trash      the Recycle Bin
  ok  clipboard  PowerShell Set-Clipboard
  ok  git        git version 2.53.0.windows.2
  ok  docker     Docker Engine 29.7.2
  ok  plugins    0 loaded, 0 failed
```

## What each check means

| Check | Shows | When it is not `ok` |
|---|---|---|
| `kiriya` | The version of kiriya | |
| `node` | The Node.js version kiriya runs on | `warn` when it is older than 22.13, the oldest release kiriya supports |
| `os` | `windows`, `linux` or `macos` | |
| `config` | Where the configuration file is, and whether it exists yet | `fail` when the file is not valid JSON or holds a value kiriya cannot use. Until it is fixed, no plugin loads |
| `trash` | Where `files delete` sends files | |
| `clipboard` | The program `clip` uses | `warn` when there is none, such as on Linux without a desktop session or a clipboard program |
| `git` | The git version | `warn` when git is not on PATH; `kiriya git` and `files clean` need it |
| `docker` | The Docker Engine version | `warn` when docker is not on PATH, or its engine is not running |
| `plugins` | How many plugins loaded and failed, then each loaded plugin with its commands and location | `fail` when a plugin the configuration lists could not load, with the reason |

A `warn` affects only the commands that need that part; everything else works.

## Exit code

`doctor` exits with 1 when the configuration file or a plugin fails, and with 0 otherwise,
warnings included. A setup script can run it first:

```bash
kiriya doctor || echo "kiriya needs attention"
```

With `--json`, each check has its `name`, its `status` and a `detail` message.

## Good to know

- `doctor` changes nothing. It looks for programs on PATH and asks git and docker for their
  versions.
- When you report a bug, include the output of `kiriya doctor` and `kiriya sys report`.
- Over MCP, `doctor` is offered to AI agents by default.

## Related

- [config](config.md) shows and changes the configuration file.
- [sys](sys.md) describes the machine and its developer tools.
- [Plugins](../guides/plugins.md) explains why a plugin may fail to load.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya doctor`

Check what this machine gives kiriya: runtime, configuration, trash, clipboard, git, docker and plugins.

```text
kiriya doctor
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya doctor
kiriya doctor --json
```
<!-- /kiriya:reference -->

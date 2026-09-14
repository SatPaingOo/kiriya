# kiriya config

kiriya's own settings, in one JSON file per user: which plugins to load, and what
`kiriya mcp` may offer AI agents.

## Common tasks

### Find the file and see what it holds

```bash
kiriya config path
kiriya config list
```

`path` prints where the file is, whether or not it exists yet. `list` shows each setting in
the file, and marks a name that is not a kiriya setting.

### See every setting kiriya reads

```bash
kiriya config keys
```

`keys` shows each setting with the values it takes and an example.
[Usage](../usage.md#configuration) lists them too.

### Load plugins

```bash
kiriya config set plugins kiriya-plugin-example ./team/kiriya-plugin
```

A list setting takes all its values at once, and replaces the list it had. A path is
relative to the folder of the configuration file. [Plugins](../guides/plugins.md) explains
how kiriya finds each one.

### Let AI agents change files

```bash
kiriya config set mcp.allowWrite true
kiriya config set mcp.allowDestroy true
```

Start the MCP server again after changing either setting.
[MCP server](../guides/mcp.md#settings) explains what each one allows.

### Read one setting in a script

```bash
kiriya config get plugins
```

`get` prints one value per line, and exits with 1 when the setting is not set.

### Remove a setting

```bash
kiriya config unset plugins
```

## The file

```json
{
  "mcp.allowWrite": "true",
  "plugins": ["kiriya-plugin-example", "./team/kiriya-plugin"]
}
```

- Each setting is a top-level name whose value is text, or a list of text for a list setting.
- `set` checks the name and the value before it writes. It refuses a name kiriya does not
  read, a second value for a setting that takes one, and a value outside a setting's choices.
- The file never holds a secret: `set` refuses a value that looks like a password, token or
  key.
- `kiriya config path` shows where the file is on this machine, and `KIRIYA_CONFIG` points
  kiriya at another file. [Usage](../usage.md#configuration) lists the location on each OS.
- There is one file per user and no project file, so a cloned repository can never change
  what kiriya loads.

## Good to know

- A file kiriya cannot read is reported with its path and the field at fault. Until it is
  fixed, no plugin loads, built-in commands keep working, and `kiriya doctor` fails its
  `config` check.
- Over MCP, `path`, `keys`, `list` and `get` are offered to AI agents by default. `set` and
  `unset` never are, so an agent cannot give itself more than you allowed or list a plugin
  of its own.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya config get`

Print one setting, one value per line.

```text
kiriya config get <key>
```

| Argument | Description |
|---|---|
| `key` | The setting's name. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya config get plugins
```

### `kiriya config keys`

List every setting kiriya reads.

```text
kiriya config keys
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya config keys
```

### `kiriya config list`

List the settings in the configuration file.

```text
kiriya config list
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya config list
kiriya config list --json
```

### `kiriya config path`

Print where the configuration file is, whether or not it exists yet.

```text
kiriya config path
```

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya config path
```

### `kiriya config set`

Change a setting; a list setting takes all its values at once.

```text
kiriya config set <key> <values...>
```

| Argument | Description |
|---|---|
| `key` | The setting's name; see kiriya config keys. |
| `values...` | The value, or every value of a list. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** never offered to AI agents, because it is only for a person at a terminal

```bash
kiriya config set plugins kiriya-plugin-example
kiriya config set plugins ./team/plugin ./my/plugin
```

### `kiriya config unset`

Remove a setting from the configuration file.

```text
kiriya config unset <key>
```

| Argument | Description |
|---|---|
| `key` | The setting's name. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** never offered to AI agents, because it is only for a person at a terminal

```bash
kiriya config unset plugins
```
<!-- /kiriya:reference -->

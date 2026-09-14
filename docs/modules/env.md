# kiriya env

Read environment variables, PATH and `.env` files the same way in every shell, instead of
`$env:NAME` in PowerShell, `%NAME%` in cmd and `$NAME` in bash, with secrets kept off the
screen.

## Common tasks

### Look up variables without showing secrets

```bash
kiriya env show
kiriya env show java
```

`show` lists every variable, or those whose name contains the filter, in any case. A value
is hidden when the variable's name looks secret, such as `GITHUB_TOKEN`, `DB_PASSWORD`,
`apiKey` or `ConnectionStrings__Default`, or when the value itself looks like one, such as a
private key, a web address with a password in it, or a JWT. `--reveal` shows hidden values:

```bash
kiriya env show token --reveal
```

### Find problems in PATH

```bash
kiriya env path
kiriya env path PYTHONPATH
```

`path` splits the variable as the operating system does, on `;` on Windows and `:`
elsewhere, and reports each entry that does not exist, repeats an earlier entry, is empty,
or is relative.

### Check a .env file against .env.example

```bash
kiriya env check
kiriya env check --file .env.local --example .env.example
```

`check` compares variable names. It reports variables from the example that the file lacks,
variables that are set but empty, variables the example does not list, and variables set
more than once, where the last one wins. It exits with 1 when a variable is missing, so a
script can run it before starting an app. It never prints a value, so its output is safe to
paste into an issue.

## Good to know

- Nothing changes. A program cannot change the environment of the shell that started it,
  so kiriya only reads.
- `show` and `path` see the environment kiriya was started with.
- Over MCP, every `env` command is offered to AI agents by default, and `--reveal` never is.

## Related

- [sys](sys.md) describes the machine and the developer tools on it.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya env check`

Compare a .env file with its .env.example by variable name; values are never shown.

```text
kiriya env check [options]
```

| Option | Description |
|---|---|
| `--file <path>` | The file to check; .env by default. |
| `--example <path>` | The file listing the variables expected; .env.example by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya env check
kiriya env check --file .env.local --example .env.example
```

### `kiriya env path`

Check each folder in PATH, or another list variable, for missing, duplicate, empty and relative entries.

```text
kiriya env path [variable]
```

| Argument | Description |
|---|---|
| `variable` | The variable to check; PATH by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya env path
kiriya env path PYTHONPATH --json
```

### `kiriya env show`

List environment variables, hiding values that look secret.

```text
kiriya env show [filter] [options]
```

| Argument | Description |
|---|---|
| `filter` | Only variables whose name contains this text, in any case. |

| Option | Description |
|---|---|
| `--reveal` | Show secret-looking values too. Only at a terminal. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya env show
kiriya env show java
kiriya env show token --reveal
```
<!-- /kiriya:reference -->

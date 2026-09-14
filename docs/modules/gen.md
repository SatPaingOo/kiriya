# kiriya gen

Make UUIDs, ULIDs, passwords and tokens with one command on every OS, instead of
`[guid]::NewGuid()` in PowerShell, `uuidgen` on macOS, or a website that sees what it makes.

Everything comes from the operating system's cryptographically secure random source,
through Node.js. kiriya stores nothing it makes and uses no network. Each command prints one
value per run, or several with `--count`.

## Common tasks

### Make an identifier

```bash
kiriya gen uuid
kiriya gen uuid --v7 --count 5
kiriya gen ulid
```

- A version 4 UUID is random. A version 7 UUID starts with the time it was made, so newer
  ones sort after older ones, which keeps database indexes compact.
- A ULID is 26 characters that also sort by the time they were made, and reads more easily
  than a UUID.

### Make a password

```bash
kiriya gen password
kiriya gen password --length 40 --no-symbols
```

A password is 24 characters by default, from 8 to 256, of letters, digits and symbols.
Every character is equally likely. `--no-symbols` leaves symbols out for systems that
refuse them.

### Make a token or an API key

```bash
kiriya gen token
kiriya gen token --bytes 64 --format hex
```

A token is 32 random bytes by default, from 8 to 1024, written as `base64url`, `base64` or
`hex`.

### Put a value straight onto the clipboard

```bash
kiriya gen password | kiriya clip copy
```

## Good to know

- Over MCP, AI agents are offered every `gen` command by default. A value an agent makes
  passes through the agent and its provider, so make passwords and tokens you will keep at
  your own terminal.
- `--json` returns the values as a list, which suits scripts that need several.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya gen password`

Make passwords of letters, digits and symbols, every character equally likely.

```text
kiriya gen password [options]
```

| Option | Description |
|---|---|
| `--length <n>` | Characters in each password, from 8 to 256; 24 by default. |
| `--no-symbols` | Leave symbols out, for systems that refuse them. |
| `--count <n>` | How many to make; 1 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya gen password
kiriya gen password --length 40 --no-symbols
```

### `kiriya gen token`

Make random tokens for secrets and API keys.

```text
kiriya gen token [options]
```

| Option | Description |
|---|---|
| `--bytes <n>` | Random bytes in each token, from 8 to 1024; 32 by default. |
| `--format <hex\|base64\|base64url>` | hex, base64 or base64url; base64url by default. |
| `--count <n>` | How many to make; 1 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya gen token
kiriya gen token --bytes 64 --format hex
```

### `kiriya gen ulid`

Make ULIDs: 26 characters that sort by the time they were made.

```text
kiriya gen ulid [options]
```

| Option | Description |
|---|---|
| `--count <n>` | How many to make; 1 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya gen ulid
kiriya gen ulid --count 10
```

### `kiriya gen uuid`

Make UUIDs: random version 4, or version 7 that sorts by creation time.

```text
kiriya gen uuid [options]
```

| Option | Description |
|---|---|
| `--v7` | Make version 7 UUIDs, which sort by the time they were made. |
| `--count <n>` | How many to make; 1 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya gen uuid
kiriya gen uuid --v7 --count 5
```
<!-- /kiriya:reference -->

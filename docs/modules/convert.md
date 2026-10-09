# kiriya convert

Convert text between base64, hex, URL encoding, JSON, JWT, times and cases entirely on this
machine, so tokens and data never go to a website.

## Where the text comes from

Most commands take the text as an argument, read what is piped in when there is no argument
or it is `-`, or read a file's exact bytes with `--file`:

```bash
kiriya convert base64 "hello"
kiriya convert base64 < notes.txt
kiriya convert base64 --file logo.png
```

## Common tasks

### Encode and decode base64 and hex

```bash
kiriya convert base64 "hello"
kiriya convert base64 --decode aGVsbG8=
kiriya convert hex --decode 68656c6c6f
```

`--url` uses base64's URL-safe alphabet, without padding. Decoded bytes that are not UTF-8
text are not printed.

### Encode a value for a web address

```bash
kiriya convert url "a b&c"
kiriya convert url --decode a%20b%26c
```

### Format, minify or check JSON

```bash
kiriya convert json --file package.json
kiriya convert json --minify < data.json
kiriya convert json --check --file config.json
```

Invalid JSON is reported with the line and column of the first error. `--check` only says
whether the JSON is valid.

### Read one value out of JSON

Every kiriya command answers `--json`, and `--get` reads that answer back without a second
tool having to be installed:

```bash
kiriya port who 3000 --json | kiriya convert json --get data.listeners.0.pid
kiriya sys info --json | kiriya convert json --get data.timeZone
kiriya convert json --file package.json --get version
```

A path is keys and indexes joined by dots. A leading dot is accepted too, so `.version` works
as well as `version`.

**Text prints as itself**, with no quotes for a shell to strip, which is what makes this work:

```bash
pid=$(kiriya port who 3000 --json | kiriya convert json --get data.listeners.0.pid)
```

Numbers, `true`, `false` and `null` print as they are written. An object or an array prints as
JSON, and `--minify` puts it on one line.

A path that is not there is a failure rather than an empty answer: nothing is printed, the
message names the part of the path that stopped — `Nothing is at data.ports` for
`data.ports.0` — and the exit code is 1, so a script can test it without reading any output.
`--check` reports only whether the JSON is valid, so it cannot be combined with `--get`.

#### What a path deliberately cannot do

This is a path, not a query language, and it stays one on purpose: there is nothing to learn
beyond dots and indexes, and no half of jq to be disappointed by.

- **No filters, wildcards or expressions.** jq exists and is better at being jq.
- **A key containing a dot cannot be reached.** Reaching it needs quoting, and quoting is the
  first rule of the language this is not.
- **Only an index reaches into an array.** `length` is JavaScript's, not your data's.
- **Only keys the document really holds.** `constructor` and `__proto__` are reachable when
  the JSON actually has such a key, and read as missing when it does not.

### Read a JWT

```bash
kiriya convert jwt --file token.txt
kiriya convert jwt < token.txt
```

`jwt` decodes the header and the payload, and shows when the token was issued, when it
becomes valid and when it expires. It never checks the signature, so nothing it shows proves
the token is genuine, and it never sends the token anywhere. A token typed as an argument
stays in your shell's history, so kiriya warns and suggests piping it in or using `--file`.

### Convert a time

```bash
kiriya convert time
kiriya convert time 1767225600
kiriya convert time 2026-01-31T12:00:00Z
```

`time` shows a moment as ISO 8601, local time, and Unix seconds and milliseconds; now, when
no value is given. A number below 100,000,000,000 is read as seconds and a larger one as
milliseconds, unless `--unit` says which.

### Change the case of names

```bash
kiriya convert case "user profile id" --to camel
kiriya convert case --to kebab < names.txt
```

Each line changes on its own, to `kebab`, `snake`, `camel`, `pascal`, `constant`, `title`,
`lower` or `upper` case.

## Good to know

- Nothing changes, and nothing leaves the machine.
- Over MCP, every `convert` command is offered to AI agents by default. Standard input
  carries the protocol there, so an agent passes the text as the value.

## Related

- [gen](gen.md) makes identifiers, passwords and tokens.
- [clip](clip.md) copies a result to the clipboard.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya convert base64`

Encode text or a file as base64, or decode base64 back to text.

```text
kiriya convert base64 [value] [options]
```

| Argument | Description |
|---|---|
| `value` | The text to convert; - or nothing reads what is piped in. |

| Option | Description |
|---|---|
| `-d, --decode` | Decode instead of encode. |
| `--file <path>` | Read a file's exact bytes instead. |
| `--url` | Use the URL-safe alphabet, without padding. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `output` | string |  |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya convert base64 "hello"
kiriya convert base64 --decode aGVsbG8=
kiriya convert base64 --file logo.png
```

### `kiriya convert case`

Change the case of text, line by line: kebab, snake, camel, pascal, constant, title, lower or upper.

```text
kiriya convert case [value] [options]
```

| Argument | Description |
|---|---|
| `value` | The text to convert; - or nothing reads what is piped in. |

| Option | Description |
|---|---|
| `--to <kebab\|snake\|camel\|pascal\|constant\|title\|lower\|upper>` | The case to change to. |
| `--file <path>` | Read a file's exact bytes instead. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `output` | string |  |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya convert case "user profile id" --to camel
kiriya convert case OrderItems --to kebab
```

### `kiriya convert hex`

Encode text or a file as hexadecimal, or decode hexadecimal back to text.

```text
kiriya convert hex [value] [options]
```

| Argument | Description |
|---|---|
| `value` | The text to convert; - or nothing reads what is piped in. |

| Option | Description |
|---|---|
| `-d, --decode` | Decode instead of encode. |
| `--file <path>` | Read a file's exact bytes instead. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `output` | string |  |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya convert hex "hello"
kiriya convert hex --decode 68656c6c6f
```

### `kiriya convert json`

Format, minify, check or read a value out of JSON, pointing at any error.

```text
kiriya convert json [value] [options]
```

| Argument | Description |
|---|---|
| `value` | The text to convert; - or nothing reads what is piped in. |

| Option | Description |
|---|---|
| `--minify` | Print it on one line. |
| `--check` | Only check it. |
| `--get <path>` | Print what is at a dotted path, such as data.listeners.0.pid. |
| `--file <path>` | Read a file's exact bytes instead. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `valid` | boolean |  |
| `output` | string or null | The formatted or minified JSON, or what --get asked for; null with --check, when the JSON is invalid, and when the path was not there. |
| `line` | number or null | Where the first error is, from 1; null when it is valid. |
| `column` | number or null |  |
| `path` | string or null | The path --get asked for; null when none was. |
| `found` | boolean or null | Whether that path was there; null when none was asked for. |
| `value` | anything | What was at the path, as JSON rather than as text; null when there was nothing to take. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya convert json --file package.json
kiriya convert json --minify < data.json
kiriya convert json --check --file config.json
kiriya convert json --file package.json --get version
kiriya convert json --get data.listeners.0.pid < who.json
```

### `kiriya convert jwt`

Decode a JWT's header and payload on this machine; the signature is never checked and nothing is sent.

```text
kiriya convert jwt [value] [options]
```

| Argument | Description |
|---|---|
| `value` | The text to convert; - or nothing reads what is piped in. |

| Option | Description |
|---|---|
| `--file <path>` | Read a file's exact bytes instead. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `header` | anything |  |
| `payload` | anything |  |
| `issuedAt` | string or null | ISO 8601 times from the iat, nbf and exp claims; null when a claim is absent. |
| `notBefore` | string or null |  |
| `expiresAt` | string or null |  |
| `expired` | boolean or null | Measured against this machine's clock; null without an exp claim. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya convert jwt < token.txt
kiriya convert jwt --file token.txt --json
```

### `kiriya convert time`

Show a moment as ISO 8601, local time, and Unix seconds and milliseconds; now by default.

```text
kiriya convert time [value] [options]
```

| Argument | Description |
|---|---|
| `value` | Unix seconds or milliseconds, or a date such as 2026-01-31T12:00:00Z. |

| Option | Description |
|---|---|
| `--unit <auto\|seconds\|ms>` | How to read a number: auto, seconds or ms; auto reads numbers below 100000000000 as seconds. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `iso` | string |  |
| `epochSeconds` | number |  |
| `epochMs` | number |  |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya convert time
kiriya convert time 1767225600
kiriya convert time 2026-01-31T12:00:00Z --json
```

### `kiriya convert url`

Percent-encode text for a URL, or decode it.

```text
kiriya convert url [value] [options]
```

| Argument | Description |
|---|---|
| `value` | The text to convert; - or nothing reads what is piped in. |

| Option | Description |
|---|---|
| `-d, --decode` | Decode instead of encode. |
| `--file <path>` | Read a file's exact bytes instead. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `output` | string |  |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya convert url "a b&c"
kiriya convert url --decode a%20b%26c
```
<!-- /kiriya:reference -->

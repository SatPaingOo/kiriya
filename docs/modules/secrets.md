# secrets

Find secrets committed into a folder's files, without printing them.

```bash
kiriya secrets scan                    # the current folder
kiriya secrets scan src --ext ts,js    # only some files
kiriya secrets scan --json             # for a script
```

## Check what you are about to commit

```bash
kiriya secrets scan
```

```text
  .env.backup:1:14  url-credentials  postgres://me:****@
  config.ts:3:17    token            ghp_****
  keys/id_rsa:1:1   private-key      -----BEGIN RSA PRIVATE KEY-----

3 finding(s) in 112 file(s)
A line with kiriya:allow-secret on it, or above it, is left alone.
```

It exits `1` when anything is found and `0` when nothing is, so a git hook or a CI step needs
no output parsing:

```bash
kiriya secrets scan || echo "something looks like a secret"
```

## What it looks for

Shapes that cannot be mistaken for ordinary code:

| Kind | What |
|---|---|
| `token` | A token whose issuer gives it a recognisable prefix: GitHub, GitLab, Slack, npm, OpenAI, and AWS access keys |
| `private-key` | A PEM private key header, of any kind |
| `url-credentials` | A password written into a URL, between the user name and the host |
| `jwt` | A JSON Web Token |

It uses the same judgement as the rest of kiriya: what `env show` hides and `config set`
refuses is what this finds.

## What it deliberately does not look for

**A line that merely assigns something named like a secret.** `looksSecret`, which `env show`
uses, treats `TOKEN=…` as a secret, and it is right to — there the name and the value are
already separate. Over source code the same rule is useless. Run against kiriya itself it
matched 42 lines, and every single one was syntax:

```ts
if (token === "--") passthrough = true;              // the argv parser
export function decodeJwt(token: string) { … }       // a parameter
readonly secret: Uint8Array;                         // a field
```

A scanner that cries wolf 42 times gets switched off and never run again, so this one does
not. The cost is that a password assigned to a plainly named variable is not found; the
benefit is that every finding is worth reading.

## Saying one is deliberate

Test fixtures and documentation contain secrets on purpose. A line saying
`kiriya:allow-secret`, on it or on the line above, is left alone:

```ts
const sample = "-----BEGIN RSA PRIVATE KEY-----"; // kiriya:allow-secret
```

```ts
// kiriya:allow-secret
const example = "ghp_0123456789abcdefghij";
```

The marker sits next to what it excuses and shows up in review, which an ignore file in a
corner does not. kiriya's own repository has six of them, and scans clean.

## Good to know

- **A finding never carries the secret.** It shows enough to tell whose it is — `ghp_****`,
  with the password replaced — and no more. A report that quoted the value would copy it into
  terminal scrollback, CI logs and issue comments, which is the opposite of the point. `--json`
  redacts identically.
- **Hidden files are read by default**, unlike everywhere else in kiriya, because `.env`,
  `.npmrc` and `.git-credentials` are exactly where secrets sit.
- **Dependency folders are skipped by default**: what you installed is not what you committed.
  `--all` scans them too.
- **Nothing is sent anywhere and nothing changes.** No service is consulted and no file is
  written.
- **Binary files and very large files are skipped**, and counted separately.
- **Documentation about secrets gets flagged, and that is right.** This page itself trips the
  scan twice: its sample output contains a redacted URL password and a private key header, and
  the scanner cannot tell a worked example from the real thing. Mark such a line, or point the
  scan at your source rather than the repository root — `kiriya secrets scan src`.
- **Over MCP it needs `mcp.allowWrite`**, like `clip paste` and `proc list --full`: it reads
  nothing but it reports where the secrets are.
- It reads the files that are there now. It does not read git history.

## Exit codes

| Code | When |
|---|---|
| `0` | Nothing found |
| `1` | At least one finding |
| `2` | A usage error |

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya secrets scan`

Scan a folder's files for tokens, private keys and passwords, without printing them.

```text
kiriya secrets scan [paths...] [options]
```

| Argument | Description |
|---|---|
| `paths...` | Folders or files to scan; the current folder by default. |

| Option | Description |
|---|---|
| `--ext <extensions>` | Only files with these extensions, such as .ts,.tsx. Can be given more than once. |
| `--name <glob>` | Only files whose name matches this glob, such as *.config.js. |
| `--all` | Also look inside dependency folders such as node_modules; hidden files are read either way. |
| `--limit <n>` | Stop after this many findings; 500 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya secrets scan
kiriya secrets scan src --ext .ts
kiriya secrets scan --json
```
<!-- /kiriya:reference -->

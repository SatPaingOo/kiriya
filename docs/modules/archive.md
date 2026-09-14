# kiriya archive

Make and open `.zip`, `.tar.gz`, `.tgz` and `.tar` archives with nothing else installed, and
with the same result on every OS: no zip, tar or 7-Zip needed.

## Common tasks

### Pack a project to send or back up

```bash
kiriya archive zip my-project --to my-project.zip --lean
kiriya archive tar my-project --to my-project.tar.gz --lean
```

Each folder keeps its own name inside the archive. `--lean` leaves out `.git`,
`node_modules` and other dependency and build folders. The archive `--to` names must not
exist yet.

### Pack a few files

```bash
kiriya archive zip src docs README.md --to handover.zip
kiriya archive tar "logs/*.log" --to logs.tgz
```

`.tar.gz` and `.tgz` are compressed with gzip; `.tar` is not compressed.

### Look inside before extracting

```bash
kiriya archive unzip release.zip --list
kiriya archive untar release.tgz --list
```

### Extract

```bash
kiriya archive unzip release.zip
kiriya archive untar node.tar.gz --to vendor/node
```

By default an archive extracts into a new folder named after it, next to it. Files that
already exist stay as they are, unless `--overwrite` is given and you type the number of
files it replaces.

## Safety

- Before extracting anything, kiriya checks every entry. When one would land outside the
  target folder, through `..` or an absolute path, nothing is extracted at all.
- Symlinks are skipped when packing, and links and special files are skipped when
  extracting; each command says how many.
- An entry whose name is not valid on this OS is skipped and reported.

## Limits

- ZIP entries must be stored or compressed with deflate, the methods almost every ZIP tool
  uses. Encrypted entries are not supported.
- ZIP64 is not supported, so a ZIP archive, and each file in it, must stay under 4 GB, with
  fewer than 65,535 entries. Use `tar` for anything larger.

## Good to know

- Over MCP, `zip` and `tar` need `mcp.allowWrite`. `unzip` and `untar` need
  `mcp.allowDestroy`, because `--overwrite` can replace files, and ask you through the client.

## Related

- [files](files.md) copies, syncs and cleans folders.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya archive tar`

Pack files and folders into a new .tar.gz or .tgz, or a .tar without compression.

```text
kiriya archive tar <paths...> [options]
```

| Argument | Description |
|---|---|
| `paths...` | Files, folders or globs; each folder keeps its own name inside the archive. |

| Option | Description |
|---|---|
| `--to <file.tar.gz>` | The archive to create, ending in .tar.gz, .tgz or .tar; it must not exist yet. |
| `--lean` | Leave out .git, node_modules and other dependency or build folders. |
| `--all` | Let globs match hidden entries and dependency folders. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya archive tar my-project --to my-project.tar.gz --lean
kiriya archive tar "logs/*.log" --to logs.tgz
kiriya archive tar dist --to dist.tar
```

### `kiriya archive untar`

List or extract a .tar.gz, .tgz or .tar, refusing entries that would land outside the target folder.

```text
kiriya archive untar <archive> [options]
```

| Argument | Description |
|---|---|
| `archive` | The .tar.gz, .tgz or .tar file. |

| Option | Description |
|---|---|
| `--to <folder>` | Where to extract; by default a folder named after the archive, next to it. |
| `--list` | List the entries and extract nothing. |
| `--overwrite` | Replace existing files, after a typed confirmation. |
| `--confirm <count>` | For --overwrite in scripts: the number of files replaced, as the prompt would ask. Only at a terminal. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya archive untar release.tar.gz
kiriya archive untar release.tgz --list
kiriya archive untar node.tar.gz --to vendor/node --overwrite
```

### `kiriya archive unzip`

List or extract a .zip, refusing entries that would land outside the target folder.

```text
kiriya archive unzip <archive> [options]
```

| Argument | Description |
|---|---|
| `archive` | The .zip file. |

| Option | Description |
|---|---|
| `--to <folder>` | Where to extract; by default a folder named after the archive, next to it. |
| `--list` | List the entries and extract nothing. |
| `--overwrite` | Replace existing files, after a typed confirmation. |
| `--confirm <count>` | For --overwrite in scripts: the number of files replaced, as the prompt would ask. Only at a terminal. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya archive unzip release.zip
kiriya archive unzip release.zip --list
kiriya archive unzip release.zip --to vendor/tool --overwrite
```

### `kiriya archive zip`

Pack files and folders into a new .zip.

```text
kiriya archive zip <paths...> [options]
```

| Argument | Description |
|---|---|
| `paths...` | Files, folders or globs; each folder keeps its own name inside the archive. |

| Option | Description |
|---|---|
| `--to <file.zip>` | The archive to create; it must not exist yet. |
| `--lean` | Leave out .git, node_modules and other dependency or build folders. |
| `--all` | Let globs match hidden entries and dependency folders. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya archive zip my-project --to my-project.zip --lean
kiriya archive zip "reports/*.pdf" --to reports.zip
kiriya archive zip src docs README.md --to handover.zip
```
<!-- /kiriya:reference -->

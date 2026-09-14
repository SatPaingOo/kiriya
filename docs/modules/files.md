# kiriya files

Everyday work on files and folders with one set of commands on every OS, instead of `dir`,
`findstr`, `robocopy` and `del` on Windows or `ls`, `find`, `grep`, `rsync` and `rm` on
Linux and macOS.

Every `files` command shares these rules:

- **Globs are kiriya's.** kiriya expands them itself, the same in every shell, so quote them.
  They ignore case, and skip hidden entries and dependency folders such as `node_modules`
  unless `--all` is given. [Usage](../usage.md#paths-and-globs) lists the patterns.
- **Nothing is replaced unasked.** Changes to many files show a plan first, deletions go to
  the trash, and removing for good or replacing what exists needs a typed confirmation.
- **Some paths are never touched.** Drive roots, the home folder, the working folder and its
  parents, and system folders are refused by every command that deletes, moves or
  overwrites. [Usage](../usage.md#protected-paths) lists them.

## Look around

```bash
kiriya files list
kiriya files list src --sort size
kiriya files tree --depth 2
```

`list` shows each entry with its type, size and modification time, and says how many hidden
entries `--all` would add. `tree` draws folders first, three levels deep by default, and
leaves dependency folders closed.

## Find files

```bash
kiriya files find --name "*.test.ts"
kiriya files find src --ext .ts,.tsx --newer 7d
kiriya files find --larger 100MB
kiriya files find --type dir --empty
```

Sizes are written as `500`, `10KB`, `1.5MB` or `2GB`, and times as `30m`, `12h`, `7d`, `2w`,
`1y`, or a date such as `2026-01-31`.

## Search inside files

```bash
kiriya files grep "TODO|FIXME"
kiriya files grep useState src --ext .tsx
kiriya files grep "connection string" --literal -i -l
```

The pattern is a JavaScript regular expression, which behaves the same on every OS, and
`--literal` searches for the text itself. Binary and large files are skipped and counted.
`-l` prints only the names of files with a match, and `-c` the number of matches in each.

## Find what takes space

```bash
kiriya files size ~/projects
kiriya files dupes ~/Downloads --min-size 1MB
```

`size` shows the largest folders, and how much of each is rebuildable, such as
`node_modules`. `dupes` finds files with identical content: it compares sizes, then a hash
of the first 64 KB, then a hash of the whole file, and shows the space the extra copies take.

## Read and inspect

```bash
kiriya files read app.log --tail 50
kiriya files read query.sql --lines 10-20 --number
kiriya files info package.json
kiriya files hash setup.exe
kiriya files compare dist backup/dist
```

- `read` prints text in UTF-8, UTF-8 with a BOM, UTF-16 LE or UTF-16 BE, and refuses a file
  that is not text.
- `hash` prints SHA-256 by default. With `--check` and the checksum a download page
  publishes, it exits with 1 when the file does not match.
- `compare` compares two files, or two folders, by content. For files it shows the first
  line that differs; for folders, the entries only on one side and those that differ. It
  exits with 1 when they differ.

## Create, copy, move and rename

```bash
kiriya files new src/app/ docs/notes.md
kiriya files copy "src/**/*.ts" snapshot/ --dry-run
kiriya files move draft.md docs/
kiriya files rename src/components --case kebab --recursive
kiriya files rename "photos/*.JPG" --find " " --with "-" --apply
```

- `new` creates any missing parent folders and never touches something that exists. A path
  ending in `/` is a folder.
- For `copy` and `move`, a target ending in `/` is always a folder to put things in.
  `copy` keeps modification times, and `move` works across drives.
- Neither replaces what exists unless `--overwrite` is given and you type the number of
  conflicts. `move --overwrite` sends each replaced item to the trash first.
- `rename` renames one entry, or many by case style or by replacing text in their names.
  Renaming many shows the plan until `--apply`, and refuses when two names would clash or a
  new name would be invalid on any OS.

## Change text across files

```bash
kiriya files replace OldName NewName src --ext .cs
kiriya files replace "v(\d+)\.0" "v$1.1" --regex --apply
```

`replace` shows the matches in each file and a few changed lines until `--apply`, then asks
before writing. It keeps each file's encoding, byte order mark and line endings, and skips
binary files and files over 50 MB. A replacement cannot be undone, so commit your work first.

## Delete and clean up

```bash
kiriya files delete "logs/*.log"
kiriya files delete build --dry-run
kiriya files delete old-backups --permanent
```

`delete` asks, then sends to the trash; `--yes` answers the question in advance. It warns
when a folder it deletes is a git repository. `--permanent` removes for good, after you type
the number of items.

```bash
kiriya files clean ~/projects
kiriya files clean --apply
```

`clean` finds rebuildable folders, and only next to the project file that recreates them, so
a hand-written `bin` or `build` folder elsewhere is never touched:

| Folders | Only next to |
|---|---|
| `node_modules`, `.next`, `.nuxt`, `.turbo`, `.svelte-kit`, `.parcel-cache`, `dist`, `build`, `coverage` | `package.json` |
| `bin`, `obj` | a `.csproj`, `.fsproj` or `.vbproj` file |
| `.venv`, `venv` | `pyproject.toml`, `requirements.txt` or `setup.py` |
| `target` | `Cargo.toml` or `pom.xml` |
| `.gradle`, `build` | `build.gradle`, `build.gradle.kts` or `settings.gradle` |
| `__pycache__`, `.pytest_cache`, `.ruff_cache`, `.mypy_cache` | Anywhere |

Folders holding files that git tracks are left alone, which needs git on PATH. `--apply`
removes the folders for good, after you type how many there are.

## Keep two folders in step

```bash
kiriya files sync photos E:/backup/photos
kiriya files sync site dist --apply
kiriya files sync docs ../mirror/docs --delete --apply
```

`sync` brings the target in line with the source. It copies the files the target lacks and
updates files whose size or modification time differs, showing the plan until `--apply` and
asking before it writes. `--delete` also deletes target files that are not in the source,
after you type the target folder's name. Symlinks are left out, and a source and target that
are the same folder, or inside each other, are refused.

## Good to know

- A name kiriya creates must be valid on Windows, Linux and macOS alike: none of
  `/ \ < > : " | ? *`, no dot or space at the end, and none of the names Windows reserves,
  such as `CON`.
- Over MCP, the commands that only read are offered to AI agents by default. `new`, `move`,
  `rename` and `replace` need `mcp.allowWrite`, and `copy`, `delete`, `clean` and `sync` need
  `mcp.allowDestroy` and ask you through the client. Every path must stay inside the server's
  roots.

## Related

- [archive](archive.md) packs folders into archives and extracts them.
- [Usage](../usage.md#safety) explains previews, confirmations and the trash.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya files clean`

Remove rebuildable build output and caches, only next to the project files that recreate them.

```text
kiriya files clean [folder] [options]
```

| Argument | Description |
|---|---|
| `folder` | The folder to search; the current folder by default. |

| Option | Description |
|---|---|
| `--depth <n>` | How many folders deep to search; 8 by default. |
| `--apply` | Remove the folders; without it kiriya only lists them. |
| `--confirm <count>` | For --apply in scripts: the number of folders, as the prompt would ask. Only at a terminal. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya files clean ~/projects
kiriya files clean --apply
kiriya files clean . --depth 3 --json
```

### `kiriya files compare`

Compare two files, or two folders, by content; exits 1 when they differ.

```text
kiriya files compare <a> <b> [options]
```

| Argument | Description |
|---|---|
| `a` | The first file or folder. |
| `b` | The second file or folder. |

| Option | Description |
|---|---|
| `--all` | In folders, include hidden entries and dependency folders. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files compare appsettings.json appsettings.Production.json
kiriya files compare dist backup/dist
kiriya files compare a b --all --json
```

### `kiriya files copy`

Copy files and folders, keeping modification times; never replaces anything unasked.

```text
kiriya files copy <sources...> <target> [options]
```

| Argument | Description |
|---|---|
| `sources...` | Files, folders or globs, followed by the target. |
| `target` | A new name, or a folder to put them in; a trailing / always means a folder. |

| Option | Description |
|---|---|
| `--overwrite` | Replace what exists at a destination, after a typed confirmation. |
| `--dry-run` | Show the plan and change nothing. |
| `--confirm <count>` | For --overwrite in scripts: the number of conflicts, as the prompt would ask. Only at a terminal. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya files copy report.txt backup/
kiriya files copy "src/**/*.ts" snapshot/ --dry-run
kiriya files copy config.json config.old.json
```

### `kiriya files delete`

Send files and folders to the trash, or remove them for good with --permanent.

```text
kiriya files delete <paths...> [options]
```

| Argument | Description |
|---|---|
| `paths...` | Paths or globs to delete. |

| Option | Description |
|---|---|
| `--permanent` | Remove for good instead of sending to the trash. |
| `--dry-run` | Show what would be deleted and change nothing. |
| `-y, --yes` | Send to the trash without asking; never enough for --permanent. Only at a terminal. |
| `--confirm <count>` | For --permanent in scripts: the number of items, as the prompt would ask. Only at a terminal. |
| `--all` | Include hidden entries and dependency folders such as node_modules. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya files delete "logs/*.log"
kiriya files delete build --dry-run
kiriya files delete old-backups --permanent
```

### `kiriya files dupes`

Find files with identical content, and the space their extra copies take.

```text
kiriya files dupes [folder] [options]
```

| Argument | Description |
|---|---|
| `folder` | The folder to search; the current folder by default. |

| Option | Description |
|---|---|
| `--min-size <size>` | Ignore files smaller than this, such as 1MB. |
| `--all` | Include hidden entries and dependency folders such as node_modules. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files dupes ~/Downloads
kiriya files dupes photos --min-size 1MB
kiriya files dupes --json
```

### `kiriya files find`

Find files and folders by name, extension, type, size, age or emptiness.

```text
kiriya files find [folder] [options]
```

| Argument | Description |
|---|---|
| `folder` | The folder to search; the current folder by default. |

| Option | Description |
|---|---|
| `--name <glob>` | A glob that ignores case, such as *.test.ts or src/**/index.*. |
| `--ext <extensions>` | Extensions, such as .ts,.tsx. Can be given more than once. |
| `--type <file\|dir>` | Only files or only folders. |
| `--larger <size>` | Larger than a size, such as 10KB. |
| `--smaller <size>` | Smaller than a size. |
| `--newer <time>` | Modified within a time, such as 7d, or after a date. |
| `--older <time>` | Modified before a time or date. |
| `--empty` | Only empty files and folders. |
| `--all` | Include hidden entries and dependency folders such as node_modules. |
| `--limit <n>` | Show at most this many results. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files find --name "*.test.ts"
kiriya files find src --ext .ts,.tsx --newer 7d
kiriya files find --type dir --empty
```

### `kiriya files grep`

Search text inside files with the same regular expressions on every OS.

```text
kiriya files grep <pattern> [paths...] [options]
```

| Argument | Description |
|---|---|
| `pattern` | A JavaScript regular expression, or exact text with --literal. |
| `paths...` | Files, folders or globs to search; the current folder by default. |

| Option | Description |
|---|---|
| `--literal` | Search for the exact text instead of a regular expression. |
| `-i, --ignore-case` | Ignore case. |
| `--ext <extensions>` | Only files with these extensions, such as .ts,.tsx. Can be given more than once. |
| `--name <glob>` | Only files whose name matches this glob, such as *.config.js. |
| `-l, --files-only` | Print only the names of files with a match. |
| `-c, --count` | Print the number of matches in each file. |
| `--all` | Include hidden entries and dependency folders such as node_modules. |
| `--limit <n>` | Show at most this many matching lines; 500 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files grep "TODO|FIXME"
kiriya files grep useState src --ext .tsx
kiriya files grep "connection string" --literal -i -l
```

### `kiriya files hash`

Print checksums of files, or check a file against a published checksum.

```text
kiriya files hash <paths...> [options]
```

| Argument | Description |
|---|---|
| `paths...` | Files or globs. |

| Option | Description |
|---|---|
| `--algo <sha256\|sha1\|md5\|sha512>` | The algorithm; sha256 by default. |
| `--check <hex>` | The checksum a single file should have; exits 1 when it does not. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files hash setup.exe
kiriya files hash "dist/*" --algo sha512
kiriya files hash node.tar.gz --check <expected-sha256>
```

### `kiriya files info`

Show type, size, dates and permissions of files or folders, and optionally a hash.

```text
kiriya files info <paths...> [options]
```

| Argument | Description |
|---|---|
| `paths...` | Paths or globs. |

| Option | Description |
|---|---|
| `--hash <sha256\|sha1\|md5\|sha512>` | Also show a hash of each file. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files info package.json
kiriya files info src --json
kiriya files info "dist/*.zip" --hash sha256
```

### `kiriya files list`

List a folder's entries with type, size and modification time.

```text
kiriya files list [path] [options]
```

| Argument | Description |
|---|---|
| `path` | The folder or file to list; the current folder by default. |

| Option | Description |
|---|---|
| `--all` | Include hidden entries and dependency folders such as node_modules. |
| `--sort <name\|size\|time>` | Sort by name, size or time. |
| `--reverse` | Reverse the order. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files list
kiriya files list src --sort size
kiriya files list --all --json
```

### `kiriya files move`

Move or rename files and folders, across drives too; never replaces anything unasked.

```text
kiriya files move <sources...> <target> [options]
```

| Argument | Description |
|---|---|
| `sources...` | Files, folders or globs, followed by the target. |
| `target` | A new name, or a folder to put them in; a trailing / always means a folder. |

| Option | Description |
|---|---|
| `--overwrite` | Replace what exists at a destination, after a typed confirmation. |
| `--dry-run` | Show the plan and change nothing. |
| `--confirm <count>` | For --overwrite in scripts: the number of conflicts, as the prompt would ask. Only at a terminal. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya files move draft.md docs/
kiriya files move readme.md README.md
kiriya files move "*.log" D:/archive/logs/ --dry-run
```

### `kiriya files new`

Create files or folders with any missing parents; never touches an existing one.

```text
kiriya files new <paths...> [options]
```

| Argument | Description |
|---|---|
| `paths...` | Paths to create; a path ending in / is a folder. |

| Option | Description |
|---|---|
| `--dir` | Create folders. |
| `--content <text>` | Text to write into each new file. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya files new notes.md
kiriya files new src/app/ docs/
kiriya files new .env.example --content "PORT=3000"
```

### `kiriya files read`

Print a text file, or part of it, in UTF-8, UTF-8 with BOM, UTF-16 LE or UTF-16 BE.

```text
kiriya files read <file> [options]
```

| Argument | Description |
|---|---|
| `file` | The text file. |

| Option | Description |
|---|---|
| `--head <n>` | Only the first n lines. |
| `--tail <n>` | Only the last n lines. |
| `--lines <from>-<to>` | Only these lines, such as 10-20. |
| `--number` | Put line numbers in front. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files read README.md
kiriya files read app.log --tail 50
kiriya files read query.sql --lines 10-20 --number
```

### `kiriya files rename`

Rename one entry, or many by case style or text replacement, with a preview.

```text
kiriya files rename [paths...] [options]
```

| Argument | Description |
|---|---|
| `paths...` | A path and its new name; with --case or --find, the folders and globs to rename. |

| Option | Description |
|---|---|
| `--case <kebab\|snake\|camel\|pascal\|lower\|upper>` | Rename to a case style. |
| `--find <text>` | Text to replace in names. |
| `--with <text>` | The replacement for --find. |
| `--recursive` | Rename everything below a folder, not only its own entries. |
| `--only <files\|dirs>` | Rename only files or only folders. |
| `--apply` | Rename; without it kiriya only shows the plan. |
| `-y, --yes` | Rename without asking. Only at a terminal. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya files rename notes.txt meeting-notes.txt
kiriya files rename src/components --case kebab --recursive
kiriya files rename "photos/*.JPG" --find " " --with "-" --apply
```

### `kiriya files replace`

Find and replace text across files, keeping each file's encoding and line endings.

```text
kiriya files replace <find> <with> [paths...] [options]
```

| Argument | Description |
|---|---|
| `find` | The text to find, or a regular expression with --regex. |
| `with` | The replacement; with --regex, $1 inserts the first group. |
| `paths...` | Files, folders or globs; the current folder by default. |

| Option | Description |
|---|---|
| `--regex` | Treat the text to find as a regular expression. |
| `-i, --ignore-case` | Ignore case. |
| `--ext <extensions>` | Only files with these extensions, such as .ts,.tsx. Can be given more than once. |
| `--name <glob>` | Only files whose name matches this glob, such as *.config.js. |
| `--all` | Include hidden entries and dependency folders such as node_modules. |
| `--apply` | Write the changes; without it kiriya only shows them. |
| `-y, --yes` | Write without asking. Only at a terminal. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya files replace OldName NewName src --ext .cs
kiriya files replace "v(\d+)\.0" "v$1.1" --regex --apply
kiriya files replace localhost:5000 localhost:8080 --name appsettings*.json --apply --yes
```

### `kiriya files size`

Show the largest folders under a folder, with rebuildable dependency and cache folders called out.

```text
kiriya files size [folder] [options]
```

| Argument | Description |
|---|---|
| `folder` | The folder to measure; the current folder by default. |

| Option | Description |
|---|---|
| `--top <n>` | How many folders to show; 15 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files size
kiriya files size ~/projects --top 30
kiriya files size --json
```

### `kiriya files sync`

Mirror one folder into another: a preview first, and no change without --apply.

```text
kiriya files sync <source> <target> [options]
```

| Argument | Description |
|---|---|
| `source` | The folder to copy from. |
| `target` | The folder to bring in line with the source. |

| Option | Description |
|---|---|
| `--delete` | Also delete target files that are not in the source. |
| `--apply` | Make the changes; without it kiriya only shows the plan. |
| `-y, --yes` | Copy without asking; never enough for --delete. Only at a terminal. |
| `--confirm <name>` | For --delete in scripts: the target folder's name, as the prompt would ask. Only at a terminal. |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya files sync photos E:/backup/photos
kiriya files sync site dist --apply
kiriya files sync docs ../mirror/docs --delete --apply
```

### `kiriya files tree`

Show a folder as a tree, folders first.

```text
kiriya files tree [path] [options]
```

| Argument | Description |
|---|---|
| `path` | The folder to draw; the current folder by default. |

| Option | Description |
|---|---|
| `--depth <n>` | How many levels to open; 3 by default. |
| `--all` | Show hidden entries and open dependency folders such as node_modules. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya files tree
kiriya files tree src --depth 5
kiriya files tree --all --json
```
<!-- /kiriya:reference -->

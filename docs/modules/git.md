# kiriya git

Work with every git repository under a folder at once: see which need attention, fetch them,
bring them up to date, or put them all on one branch. kiriya runs the git on PATH in each
repository it finds, and never commits, pushes, merges, rebases or stashes.

Each command takes a repository, or a folder holding repositories, and looks for
repositories up to 3 folder levels deep; `--depth` goes up to 10.

## Common tasks

### See the state of every repository

```bash
kiriya git status ~/code
kiriya git status ~/code --json
```

`status` shows each repository's branch, its number of commits, its uncommitted files, how
far it is ahead of or behind its upstream, and whether it has a remote. It then calls out
what needs attention: a repository with no remote, so nothing in it is backed up; unpushed
commits; and a repository on a different branch from most of the others.

### Fetch everything

```bash
kiriya git fetch ~/code
```

`fetch` fetches all the remotes of every repository and prunes branches deleted on them. A
fetch that fails is reported, the others still run, and the command exits with 1.

### Bring every repository up to date

```bash
kiriya git pull ~/code
```

`pull` only fast-forwards. It skips a repository with uncommitted files, no remote or no
upstream branch, and says why. A repository that cannot fast-forward is reported as not
pulled, and the command exits with 1.

### Put every repository on one branch

```bash
kiriya git switch main ~/code
kiriya git switch feature/login ~/code --create
```

`switch` shows what it will do in each repository and asks before it changes anything. It
switches to the local branch, or creates one tracking `origin` when only the remote has the
branch. With `--create`, a repository that has the branch nowhere gets a new one from its
current commit. A repository with uncommitted files is not switched.

## Good to know

- git must be on PATH; `kiriya doctor` checks it.
- `fetch` and `pull` use the network.
- Over MCP, `status` is offered to AI agents by default, and `fetch`, `pull` and `switch`
  need `mcp.allowWrite`. No tool that changes something may reach inside a `.git` folder.

## Related

- [files](files.md) `clean` removes rebuildable folders across projects, and leaves folders
  git tracks alone.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya git fetch`

Fetch every repository under a folder from all its remotes, pruning deleted branches.

```text
kiriya git fetch [folder] [options]
```

| Argument | Description |
|---|---|
| `folder` | A repository, or a folder holding repositories; the current folder by default. |

| Option | Description |
|---|---|
| `--depth <1-10>` | How many folder levels to search for repositories; 3 by default. |

- **Safety:** `write`, can change things, in ways that can be undone
- **Network:** uses the network
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya git fetch
kiriya git fetch ~/work --depth 2
```

### `kiriya git pull`

Fast-forward every clean repository under a folder; never merges, rebases or stashes.

```text
kiriya git pull [folder] [options]
```

| Argument | Description |
|---|---|
| `folder` | A repository, or a folder holding repositories; the current folder by default. |

| Option | Description |
|---|---|
| `--depth <1-10>` | How many folder levels to search for repositories; 3 by default. |

- **Safety:** `write`, can change things, in ways that can be undone
- **Network:** uses the network
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya git pull
kiriya git pull ~/work --json
```

### `kiriya git status`

Show every repository under a folder: branch, commits, uncommitted files, unpushed work and remote.

```text
kiriya git status [folder] [options]
```

| Argument | Description |
|---|---|
| `folder` | A repository, or a folder holding repositories; the current folder by default. |

| Option | Description |
|---|---|
| `--depth <1-10>` | How many folder levels to search for repositories; 3 by default. |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya git status
kiriya git status ~/work --depth 2
kiriya git status --json
```

### `kiriya git switch`

Put every repository under a folder on one branch.

```text
kiriya git switch <branch> [folder] [options]
```

| Argument | Description |
|---|---|
| `branch` | The branch to switch to. |
| `folder` | A repository, or a folder holding repositories; the current folder by default. |

| Option | Description |
|---|---|
| `--create` | Create the branch from the current commit wherever it does not exist yet. |
| `--depth <1-10>` | How many folder levels to search for repositories; 3 by default. |
| `-y, --yes` | Switch without asking. Only at a terminal. |

- **Safety:** `write`, can change things, in ways that can be undone
- **MCP:** offered to AI agents when `mcp.allowWrite` is `true`

```bash
kiriya git switch main
kiriya git switch feature/login ~/work --create
kiriya git switch develop --yes
```
<!-- /kiriya:reference -->

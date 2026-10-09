# kiriya docker

Run the docker compose project in the current folder with the same commands on every OS, and
win back disk space from the Docker engine. kiriya runs the `docker` program on PATH, so
Docker with Compose must be installed and its engine running; `kiriya doctor` checks both.

## Which project

Commands act on the compose file in the current folder: `compose.yaml`, `compose.yml`,
`docker-compose.yaml` or `docker-compose.yml`. `--file` names another one.

## Common tasks

### See the containers

```bash
kiriya docker ps
kiriya docker ps --projects
```

`ps` lists the project's containers with their state and published ports, such as
`localhost:8080 -> api:80`. `--projects` lists every compose project on the machine instead.

The two answer in different shapes, and `--json` says which: without `--projects`, `mode` is
`project` and `containers` holds this project's; with it, `mode` is `projects` and `projects`
holds one entry per project on the machine.

### Start, stop and rebuild

```bash
kiriya docker up
kiriya docker up api db --build
kiriya docker down
kiriya docker rebuild api
```

- `up` starts the project, or only the services named, in the background. `--build` builds
  their images first.
- `down` stops and removes the project's containers, and keeps its volumes.
- `rebuild` builds the images again from source and recreates the containers; volumes stay.

The output of `docker compose` appears as it runs.

### Read logs

```bash
kiriya docker logs
kiriya docker logs api -f
kiriya docker logs db --tail all
```

`logs` shows the last 200 lines of each service by default. `-f` keeps printing new lines
until Ctrl+C.

### Delete the project's data

```bash
kiriya docker down --volumes
```

`--volumes` also deletes the project's volumes and all the data in them, after you type the
project's name. In a script, pass the name: `kiriya docker down --volumes --confirm=my-project`.

### Win back disk space

```bash
kiriya docker clean
kiriya docker clean --apply
kiriya docker clean --volumes --apply
```

`clean` first shows how much space Docker can reclaim. `--apply` removes stopped containers,
dangling images, unused networks and the build cache, after you type `prune`, and
`--volumes` also removes unused anonymous volumes and the data in them. It cleans the whole
engine, not only the project in this folder.

## Good to know

- Over MCP, `ps` and `logs` are offered to AI agents by default, without `--follow`. `down`
  and `clean` need `mcp.allowDestroy` and ask you through the client. `up` and `rebuild` are
  never offered, because a compose file names the programs they start.

## Related

- [wait](wait.md) waits until a service's port or health check answers after `up`.

<!-- kiriya:reference -->
<!-- Written by `npm run docs` from the command specs. Change the specs, not this part. -->

## Reference

### `kiriya docker clean`

Show what Docker can reclaim, then remove stopped containers, dangling images, unused networks and build cache.

```text
kiriya docker clean [options]
```

| Option | Description |
|---|---|
| `--volumes` | Also remove unused anonymous volumes and the data in them. |
| `--apply` | Remove them; without it kiriya only shows the space they take. |
| `--confirm prune` | For --apply in scripts: the word prune, as the prompt would ask. Only at a terminal. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `usage` | list |  |
| `usage[].type` | string |  |
| `usage[].total` | string |  |
| `usage[].active` | string |  |
| `usage[].size` | string |  |
| `usage[].reclaimable` | string |  |
| `volumes` | boolean |  |
| `results` | list |  |
| `results[].target` | string | container, image, network, builder or volume. |
| `results[].succeeded` | boolean |  |
| `results[].reclaimed` | string or null |  |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya docker clean
kiriya docker clean --apply
kiriya docker clean --volumes --apply --confirm=prune
```

### `kiriya docker down`

Stop and remove the project's containers; its volumes stay unless --volumes.

```text
kiriya docker down [options]
```

| Option | Description |
|---|---|
| `--file <compose.yaml>` | The compose file; by default compose.yaml, compose.yml, docker-compose.yaml or docker-compose.yml here. |
| `--volumes` | Also delete the project's volumes and all data in them, after a typed confirmation. |
| `--confirm <project>` | For --volumes in scripts: the project name, as the prompt would ask. Only at a terminal. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `project` | string |  |
| `volumes` | boolean |  |
| `succeeded` | boolean |  |

- **Safety:** `destroy`, can do work that cannot be undone, and asks for a typed confirmation first
- **MCP:** offered to AI agents with elicitation when `mcp.allowDestroy` is `true`

```bash
kiriya docker down
kiriya docker down --volumes
kiriya docker down --volumes --confirm=my-project
```

### `kiriya docker logs`

Show the project's logs, optionally following them.

```text
kiriya docker logs [services...] [options]
```

| Argument | Description |
|---|---|
| `services...` | The services to act on; every service by default. |

| Option | Description |
|---|---|
| `--file <compose.yaml>` | The compose file; by default compose.yaml, compose.yml, docker-compose.yaml or docker-compose.yml here. |
| `-f, --follow` | Keep printing new lines until Ctrl+C. Only at a terminal. |
| `--tail <n\|all>` | How many lines to show from the end of each log, or all; 200 by default. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `project` | string |  |
| `succeeded` | boolean |  |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya docker logs
kiriya docker logs api -f
kiriya docker logs db --tail all
```

### `kiriya docker ps`

List the containers of the compose project here, or every compose project.

```text
kiriya docker ps [options]
```

| Option | Description |
|---|---|
| `--file <compose.yaml>` | The compose file; by default compose.yaml, compose.yml, docker-compose.yaml or docker-compose.yml here. |
| `--projects` | List every compose project on this machine instead. |

With `--json`, `data` holds one of these:

When `mode` is `project`:

| Field | Type | Description |
|---|---|---|
| `mode` | always `project` |  |
| `project` | string |  |
| `file` | string |  |
| `containers` | list |  |
| `containers[].name` | string |  |
| `containers[].service` | string |  |
| `containers[].state` | string |  |
| `containers[].status` | string |  |
| `containers[].ports` | string |  |

When `mode` is `projects`:

| Field | Type | Description |
|---|---|---|
| `mode` | always `projects` |  |
| `projects` | list |  |
| `projects[].name` | string |  |
| `projects[].status` | string |  |
| `projects[].configFiles` | string |  |

- **Safety:** `read`, changes nothing
- **MCP:** offered to AI agents by default

```bash
kiriya docker ps
kiriya docker ps --projects
kiriya docker ps --file deploy/compose.yaml --json
```

### `kiriya docker rebuild`

Rebuild the project's images from source and recreate its containers; volumes stay.

```text
kiriya docker rebuild [services...] [options]
```

| Argument | Description |
|---|---|
| `services...` | The services to act on; every service by default. |

| Option | Description |
|---|---|
| `--file <compose.yaml>` | The compose file; by default compose.yaml, compose.yml, docker-compose.yaml or docker-compose.yml here. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `project` | string |  |
| `file` | string |  |
| `services` | list of string |  |
| `succeeded` | boolean |  |
| `ports` | list | Ports the compose file publishes, for the services started. |
| `ports[].host` | string |  |
| `ports[].service` | string |  |
| `ports[].target` | string |  |

- **Safety:** `write`, can change things, in ways that can be undone
- **Programs:** runs programs the user names
- **MCP:** never offered to AI agents, because it runs programs the user names

```bash
kiriya docker rebuild
kiriya docker rebuild api
```

### `kiriya docker up`

Start the compose project in the background, optionally building its images first.

```text
kiriya docker up [services...] [options]
```

| Argument | Description |
|---|---|
| `services...` | The services to act on; every service by default. |

| Option | Description |
|---|---|
| `--file <compose.yaml>` | The compose file; by default compose.yaml, compose.yml, docker-compose.yaml or docker-compose.yml here. |
| `--build` | Build the images before starting. |

With `--json`, `data` holds:

| Field | Type | Description |
|---|---|---|
| `project` | string |  |
| `file` | string |  |
| `services` | list of string |  |
| `succeeded` | boolean |  |
| `ports` | list | Ports the compose file publishes, for the services started. |
| `ports[].host` | string |  |
| `ports[].service` | string |  |
| `ports[].target` | string |  |

- **Safety:** `write`, can change things, in ways that can be undone
- **Programs:** runs programs the user names
- **MCP:** never offered to AI agents, because it runs programs the user names

```bash
kiriya docker up
kiriya docker up api db --build
kiriya docker up --file deploy/compose.yaml
```
<!-- /kiriya:reference -->

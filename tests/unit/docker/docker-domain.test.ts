import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCompose, portMappings, projectNameFromFolder } from "../../../src/modules/docker/domain/compose-file.js";
import {
  parseContainers,
  parseDiskUsage,
  parseJsonRecords,
  parseProjects,
  reclaimedSpace,
} from "../../../src/modules/docker/domain/engine-output.js";

const COMPOSE = [
  "name: shop-local",
  "",
  "services:",
  "  api:",
  "    image: shop-api",
  "    build:",
  "      context: ./api",
  "      dockerfile: Dockerfile",
  "    container_name: shop-api",
  "    ports:",
  '      - "8080:80"',
  '      - "127.0.0.1:8443:443/tcp"',
  "    environment:",
  "      - APP_ENV=development",
  "    restart: unless-stopped   # keep it up",
  "  db:",
  "    image: postgres:17",
  "    ports:",
  "      - 5432",
  "",
  "volumes:",
  "  data:",
  "    name: shop-local_data",
].join("\n");

test("a compose file gives its project name, services, containers, ports and build context", () => {
  const { project, services } = parseCompose(COMPOSE, "fallback");
  assert.equal(project, "shop-local");
  assert.deepEqual(services, [
    { name: "api", container: "shop-api", ports: ["8080:80", "127.0.0.1:8443:443/tcp"], buildContext: "./api" },
    { name: "db", container: null, ports: ["5432"], buildContext: null },
  ]);
  assert.deepEqual(portMappings(services), [
    { host: "8080", service: "api", target: "80" },
    { host: "8443", service: "api", target: "443" },
  ]);
});

test("without a top-level name the project is named after its folder, as docker compose does", () => {
  assert.equal(parseCompose("services:\n  web:\n    image: nginx\n", "my-folder").project, "my-folder");
  assert.equal(projectNameFromFolder("My Shop.App"), "myshopapp");
});

test("JSON arrives as one array or as one object per line, and broken lines are skipped", () => {
  assert.equal(parseJsonRecords('[{"a":1},{"b":2}]').length, 2);
  assert.equal(parseJsonRecords('{"a":1}\nnot json\n{"b":2}\n').length, 2);
  assert.deepEqual(parseJsonRecords("  "), []);
});

test("containers, projects, disk usage and reclaimed space are read from docker's output", () => {
  const containers = parseContainers(
    [
      '{"Name":"shop-api","Service":"api","State":"running","Status":"Up 2 minutes","Ports":"0.0.0.0:8080->80/tcp"}',
      '{"Name":"shop-db","Service":"db","State":"exited","Status":"Exited (0)","Ports":""}',
    ].join("\n"),
  );
  assert.deepEqual(
    containers.map((container) => [container.name, container.service, container.state]),
    [
      ["shop-api", "api", "running"],
      ["shop-db", "db", "exited"],
    ],
  );
  assert.deepEqual(parseProjects('[{"Name":"shop-local","Status":"running(2)","ConfigFiles":"/srv/compose.yaml"}]'), [
    { name: "shop-local", status: "running(2)", configFiles: "/srv/compose.yaml" },
  ]);
  assert.deepEqual(
    parseDiskUsage('{"Type":"Images","TotalCount":"3","Active":"1","Size":"1.2GB","Reclaimable":"800MB (66%)"}'),
    [{ type: "Images", total: "3", active: "1", size: "1.2GB", reclaimable: "800MB (66%)" }],
  );
  assert.equal(reclaimedSpace("Deleted Images:\nabc\n\nTotal reclaimed space: 1.5GB\n"), "1.5GB");
  assert.equal(reclaimedSpace("nothing"), null);
});

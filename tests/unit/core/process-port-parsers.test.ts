import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeProcAddress,
  parseProcNetTcp,
} from "../../../src/core/infrastructure/platform/linux/linux-port-table.adapter.js";
import {
  parseProcStat,
  residentMemory,
} from "../../../src/core/infrastructure/platform/linux/linux-process-table.adapter.js";
import {
  mergeListeners,
  parseLsofListeners,
  parseMacosNetstat,
} from "../../../src/core/infrastructure/platform/macos/macos-port-table.adapter.js";
import {
  parsePsArgs,
  parsePsStats,
} from "../../../src/core/infrastructure/platform/macos/macos-process-table.adapter.js";
import { parseWindowsNetstat } from "../../../src/core/infrastructure/platform/windows/windows-port-table.adapter.js";
import {
  csvFields,
  parseCimProcesses,
  parseTasklist,
} from "../../../src/core/infrastructure/platform/windows/windows-process-table.adapter.js";

test("Windows: netstat listeners are found by their foreign port of 0, in whatever language the state is", () => {
  const output = [
    "",
    "Active Connections",
    "",
    "  Proto  Local Address          Foreign Address        State           PID",
    "  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1120",
    "  TCP    127.0.0.1:5432         0.0.0.0:0              ABHÖREN         4321",
    "  TCP    192.168.1.5:50000      20.1.2.3:443           ESTABLISHED     999",
    "  TCP    [::]:135               [::]:0                 LISTENING       1120",
    "  TCP    [::1]:8080             [::]:0                 LISTENING       77",
    "  UDP    0.0.0.0:5353           *:*                                    2222",
  ].join("\r\n");
  assert.deepEqual(parseWindowsNetstat(output), [
    { address: "0.0.0.0", port: 135, pid: 1120 },
    { address: "127.0.0.1", port: 5432, pid: 4321 },
    { address: "::", port: 135, pid: 1120 },
    { address: "::1", port: 8080, pid: 77 },
  ]);
});

test("Windows: tasklist rows give names, ids and memory, and CIM JSON adds parents and command lines", () => {
  assert.deepEqual(csvFields('"a,b","2",""'), ["a,b", "2", ""]);
  const tasklist = [
    '"System Idle Process","0","Services","0","8 K"',
    '"node.exe","4100","Console","1","45,120 K"',
    "INFO: something else",
  ].join("\r\n");
  assert.deepEqual(parseTasklist(tasklist), [
    { pid: 0, ppid: null, name: "System Idle Process", command: null, memoryBytes: 8 * 1024 },
    { pid: 4100, ppid: null, name: "node.exe", command: null, memoryBytes: 45_120 * 1024 },
  ]);

  const rows = [
    '{"pid":4100,"ppid":3000,"name":"node.exe","command":"node server.js","memory":1048576}',
    '{"pid":4,"ppid":0,"name":"System","command":null,"memory":null}',
  ];
  assert.deepEqual(parseCimProcesses(`${String.fromCharCode(0xfeff)}[${rows.join(",")}]\r\n`), [
    { pid: 4100, ppid: 3000, name: "node.exe", command: "node server.js", memoryBytes: 1_048_576 },
    { pid: 4, ppid: 0, name: "System", command: null, memoryBytes: null },
  ]);
  assert.equal(parseCimProcesses("Get-CimInstance : Access denied"), null);
});

test("Linux: /proc addresses decode, and only listening sockets are kept", () => {
  assert.equal(decodeProcAddress("0100007F"), "127.0.0.1");
  assert.equal(decodeProcAddress("00000000"), "0.0.0.0");
  assert.equal(decodeProcAddress("00000000000000000000000001000000"), "::1");
  assert.equal(decodeProcAddress("0".repeat(32)), "::");
  assert.equal(decodeProcAddress("000080FE000000000000000001000000"), "fe80::1");
  const table = [
    "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode",
    "   0: 0100007F:1538 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 24680 1 0 100 0 0 10 0",
    "   1: 0100007F:A1B2 0100007F:1538 01 00000000:00000000 00:00000000 00000000  1000        0 13579 1 0 100 0 0 10 0",
  ].join("\n");
  assert.deepEqual(parseProcNetTcp(table), [{ address: "127.0.0.1", port: 5432, inode: "24680" }]);
});

test("Linux: a name in stat may hold spaces and parentheses, and memory comes from VmRSS", () => {
  assert.deepEqual(parseProcStat("4100 (my (odd) name) S 1 4100 4100 0 -1"), { comm: "my (odd) name", ppid: 1 });
  assert.equal(parseProcStat("garbage"), null);
  assert.equal(residentMemory("Name:\tnode\nVmRSS:\t   51200 kB\nThreads:\t11\n"), 51_200 * 1024);
  assert.equal(residentMemory("Name:\tkthreadd\nThreads:\t1\n"), null);
});

test("macOS: netstat gives every listener, lsof the owners it may see, and the two merge", () => {
  const netstat = [
    "Active Internet connections (including servers)",
    "Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)",
    "tcp4       0      0  127.0.0.1.5432         *.*                    LISTEN",
    "tcp46      0      0  *.3000                 *.*                    LISTEN",
    "tcp6       0      0  ::1.8080               *.*                    LISTEN",
    "tcp4       0      0  192.168.1.5.50000      17.1.2.3.443           ESTABLISHED",
  ].join("\n");
  const all = parseMacosNetstat(netstat);
  assert.deepEqual(all, [
    { address: "127.0.0.1", port: 5432, pid: null },
    { address: "::", port: 3000, pid: null },
    { address: "::1", port: 8080, pid: null },
  ]);
  const owned = parseLsofListeners("p501\nf5\nn*:3000\np777\nf9\nn127.0.0.1:9000\n");
  assert.deepEqual(owned, [
    { pid: 501, address: "*", port: 3000 },
    { pid: 777, address: "127.0.0.1", port: 9000 },
  ]);
  assert.deepEqual(mergeListeners(all, owned), [
    { address: "127.0.0.1", port: 5432, pid: null },
    { address: "::", port: 3000, pid: 501 },
    { address: "::1", port: 8080, pid: null },
    { address: "127.0.0.1", port: 9000, pid: 777 },
  ]);
});

test("macOS: ps names keep their spaces, and memory arrives in kilobytes", () => {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const stats = parsePsStats(`    1     0  12345 /sbin/launchd\n  501     1   2048 ${chrome}\n`);
  assert.deepEqual(stats.get(501), { ppid: 1, memoryBytes: 2048 * 1024, path: chrome });
  assert.equal(parsePsArgs(`  501 ${chrome} --type=renderer\n`).get(501), `${chrome} --type=renderer`);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { splitWords } from "../../../src/core/domain/text-case.js";
import { renameByCase } from "../../../src/modules/files/domain/case-style.js";

test("words come apart at case changes, digits and separators", () => {
  assert.deepEqual(splitWords("userProfile_v2 Final"), ["user", "Profile", "v2", "Final"]);
  assert.deepEqual(splitWords("HTTPServer"), ["HTTP", "Server"]);
});

test("names change case, keeping suffixes, extensions and dotfiles", () => {
  assert.equal(renameByCase("UserProfile.tsx", "kebab"), "user-profile.tsx");
  assert.equal(renameByCase("user_service.test.ts", "pascal"), "UserService.test.ts");
  assert.equal(renameByCase("HTTPServer.cs", "snake"), "http_server.cs");
  assert.equal(renameByCase("my file (2).txt", "camel"), "myFile2.txt");
  assert.equal(renameByCase("Order Items", "kebab"), "order-items");
  assert.equal(renameByCase(".gitignore", "pascal"), ".gitignore");
  assert.equal(renameByCase("README", "lower"), "readme");
  assert.equal(renameByCase("notes.md", "upper"), "NOTES.md");
});

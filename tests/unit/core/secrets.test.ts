import assert from "node:assert/strict";
import { test } from "node:test";
import { isSecretName, looksSecret } from "../../../src/core/domain/secrets.js";

test("names that usually hold a secret are recognised", () => {
  const secret = [
    "GITHUB_TOKEN",
    "DB_PASSWORD",
    "DB_PWD",
    "apiKey",
    "AWS_SECRET_ACCESS_KEY",
    "NPM_AUTHTOKEN",
    "SESSION_SECRET",
    "ConnectionStrings__Default",
    "AZURE_STORAGE_ACCOUNT_KEY",
    "SENTRY_DSN",
  ];
  for (const name of secret) assert.equal(isSecretName(name), true, name);
});

test("ordinary names, including the working folder's PWD, are not", () => {
  const plain = [
    "PATH",
    "PWD",
    "OLDPWD",
    "HOME",
    "SSH_AUTH_SOCK",
    "TOKENIZERS_PARALLELISM",
    "KEYBOARD_LAYOUT",
    "PSModulePath",
  ];
  for (const name of plain) assert.equal(isSecretName(name), false, name);
});

test("values that carry a secret are recognised whatever their name", () => {
  const secret = [
    "Server=db;User Id=app;Password=example",
    "postgres://app:example@db:5432/app",
    `ghp_${"a".repeat(36)}`,
    `AKIA${"A".repeat(16)}`,
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.signature",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
  ];
  for (const value of secret) assert.equal(looksSecret(value), true, value);
  const plain = ["https://example.com/path", "https://user@example.com", "kiriya-plugin-desk-tools", "/usr/local/bin"];
  for (const value of plain) assert.equal(looksSecret(value), false, value);
});

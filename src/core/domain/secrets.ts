import { splitWords } from "./text-case.js";

const SECRET_ASSIGNMENT = /(pass(word)?|pwd|secret|token|api[-_]?key)\s*[=:]/i;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
/** `scheme://user:password@host`. kiriya:allow-secret */
const URL_CREDENTIALS = /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i;
/** A JSON Web Token: two base64url JSON parts, then the signature. */
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\./;
/** Tokens whose issuers give them a recognisable prefix, such as GitHub, GitLab, Slack and npm tokens and AWS access keys. */
const PREFIXED_TOKEN =
  /^(?:(?:ghp|gho|ghu|ghs|ghr)_|github_pat_|glpat-|xox[abprs]-|npm_|sk-)[A-Za-z0-9_-]{16,}$|^AKIA[0-9A-Z]{16}$/;

/** Text that looks like it carries a secret: `Password=...`, a private key, a URL with a password, or a token. */
export function looksSecret(value: string): boolean {
  return (
    SECRET_ASSIGNMENT.test(value) ||
    PRIVATE_KEY.test(value) ||
    URL_CREDENTIALS.test(value) ||
    JWT.test(value) ||
    PREFIXED_TOKEN.test(value.trim())
  );
}

export const SECRET_KINDS = ["private-key", "url-credentials", "jwt", "token"] as const;
export type SecretKind = (typeof SECRET_KINDS)[number];

export interface SecretMatch {
  readonly kind: SecretKind;
  readonly start: number;
  readonly length: number;
}

/**
 * Patterns that identify a secret by its own shape, for finding one inside a line of a file.
 *
 * `SECRET_ASSIGNMENT` is deliberately not here. It serves `looksSecret`, which judges a whole
 * value where the name and the value are already separate, and it is useless over source code:
 * run against kiriya itself it matched 42 lines and every one was wrong — `if (token === "--")`
 * in the argv parser, `decodeJwt(token: string)`, `readonly secret: Uint8Array`. A scanner that
 * cries wolf 42 times gets turned off, so it scans only for what cannot be mistaken for syntax.
 */
const SCANNED: readonly { readonly kind: SecretKind; readonly pattern: RegExp }[] = [
  { kind: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: "url-credentials", pattern: /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/gi },
  { kind: "jwt", pattern: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g },
  {
    kind: "token",
    pattern: /(?:(?:ghp|gho|ghu|ghs|ghr)_|github_pat_|glpat-|xox[abprs]-|npm_|sk-)[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}/g,
  },
];

/** Every secret in one piece of text, earliest first, without overlaps. */
export function findSecrets(text: string): readonly SecretMatch[] {
  const found: SecretMatch[] = [];
  const taken: { start: number; end: number }[] = [];
  for (const { kind, pattern } of SCANNED) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (taken.some((range) => start < range.end && end > range.start)) continue;
      taken.push({ start, end });
      found.push({ kind, start, length: match[0].length });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/**
 * What may be printed about a match: enough to recognise whose secret it is, never enough to
 * use it. A finding that carried the value would copy it into scrollback, CI logs and issue
 * comments, which is the opposite of the point.
 */
export function redactSecret(text: string, match: SecretMatch): string {
  const value = text.slice(match.start, match.start + match.length);
  // The marker line is not itself secret, and it is what tells you what you are looking at.
  if (match.kind === "private-key") return value;
  const prefix = /^(?:(?:ghp|gho|ghu|ghs|ghr)_|github_pat_|glpat-|xox[abprs]-|npm_|sk-|AKIA|eyJ)/.exec(value);
  if (prefix !== null) return `${prefix[0]}****`;
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:/i.exec(value);
  return scheme === null ? "****" : `${scheme[0]}****@`;
}

const SECRET_WORDS: ReadonlySet<string> = new Set([
  "password",
  "passwd",
  "passphrase",
  "pass",
  "pwd",
  "secret",
  "secrets",
  "token",
  "tokens",
  "credential",
  "credentials",
  "cookie",
  "dsn",
]);
const SECRET_ENDINGS = /(?:password|passwd|passphrase|secret|token)s?$/;
const SECRET_PHRASES: readonly string[] = [
  "apikey",
  "accesskey",
  "privatekey",
  "secretkey",
  "signingkey",
  "encryptionkey",
  "masterkey",
  "licensekey",
  "subscriptionkey",
  "accountkey",
  "connectionstring",
];

/**
 * A variable or setting name whose value is usually a secret, such as `GITHUB_TOKEN`,
 * `DB_PASSWORD`, `apiKey` or `ConnectionStrings__Default`. `PWD`, the working folder, is not.
 */
export function isSecretName(name: string): boolean {
  if (name.toUpperCase() === "PWD") return false;
  const words = splitWords(name).map((word) => word.toLowerCase());
  const joined = words.join("");
  return (
    words.some((word) => SECRET_WORDS.has(word) || SECRET_ENDINGS.test(word)) ||
    SECRET_PHRASES.some((phrase) => joined.includes(phrase))
  );
}

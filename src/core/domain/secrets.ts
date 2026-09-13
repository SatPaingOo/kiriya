import { splitWords } from "./text-case.js";

const SECRET_ASSIGNMENT = /(pass(word)?|pwd|secret|token|api[-_]?key)\s*[=:]/i;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
/** `scheme://user:password@host`. */
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

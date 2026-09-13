const SECRET_ASSIGNMENT = /(pass(word)?|pwd|secret|token|api[-_]?key)\s*[=:]/i;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

/** Text that looks like it carries a secret, such as `Password=...` or a private key. */
export function looksSecret(value: string): boolean {
  return SECRET_ASSIGNMENT.test(value) || PRIVATE_KEY.test(value);
}

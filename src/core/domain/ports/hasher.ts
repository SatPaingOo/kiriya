export const HASH_ALGORITHMS = ["sha256", "sha1", "md5", "sha512"] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

export interface Hasher {
  /** Lower-case hex digest of a file read in chunks; of only its first `limitBytes` when given. */
  hashFile(path: string, algorithm: HashAlgorithm, limitBytes?: number): Promise<string>;
}

import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id with the OWASP recommended starting parameters. Memory cost is in
 * KiB, so 19456 is about 19 MiB per hash.
 */
const ARGON_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed hash in the database must fail closed, not throw a 500 that
    // reveals something about the stored value.
    return false;
  }
}

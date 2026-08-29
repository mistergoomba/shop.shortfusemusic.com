import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing for the single administrator.
 *
 * scrypt via Node's own crypto rather than argon2 or bcrypt: both of those are
 * native modules that are awkward to bundle for serverless, and scrypt is a
 * memory-hard KDF entirely adequate for one password. Kept in its own module,
 * free of any Next.js imports, so it can be tested directly.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// N=2^15 with r=8 needs 128*N*r = 32MiB, which is exactly Node's default
// maxmem and therefore rejected outright. Give it room.
const MAXMEM = 64 * 1024 * 1024;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEYLEN = 64;

/** Produces `scrypt$N$r$p$<salt-hex>$<hash-hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN, { ...SCRYPT, maxmem: MAXMEM });
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

/**
 * Constant-time verification. Returns false rather than throwing on a
 * malformed stored hash, so a misconfigured env var cannot produce an error
 * that distinguishes "bad config" from "wrong password".
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
      return false;
    }

    const salt = Buffer.from(parts[4]!, "hex");
    const expected = Buffer.from(parts[5]!, "hex");
    if (salt.length === 0 || expected.length === 0) return false;

    const derived = await scrypt(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAXMEM,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

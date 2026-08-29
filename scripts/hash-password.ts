/**
 * Generates the ADMIN_PASSWORD_HASH value for .env.
 *
 *   pnpm admin:password 'your-password-here'
 *
 * The plain password is never stored anywhere -- copy the printed hash into
 * .env (locally) and into the Vercel dashboard (production).
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// N=2^15 with r=8 needs 128*N*r = 32MiB, which is exactly Node's default
// maxmem and therefore rejected. Give it room.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const password = process.argv[2];

if (!password) {
  console.error("Usage: pnpm admin:password 'your-password-here'");
  process.exit(1);
}

if (password.length < 12) {
  console.error(
    `That password is ${password.length} characters. Use at least 12 —\n` +
      "this single password is the only thing standing between the internet\n" +
      "and your refund button.",
  );
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64, SCRYPT);
const { N, r, p } = SCRYPT;
const hash = [
  "scrypt",
  N,
  r,
  p,
  salt.toString("hex"),
  derived.toString("hex"),
].join("$");

console.log("\nAdd this to your .env (and to Vercel's environment variables):\n");
console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
console.log(`\nAlso set a session secret if you have not already:\n`);
console.log(`ADMIN_SESSION_SECRET="${randomBytes(32).toString("base64")}"\n`);

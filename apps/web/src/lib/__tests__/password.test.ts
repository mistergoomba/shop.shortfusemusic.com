import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(
      true,
    );
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("Correct horse battery staple", hash)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same-password-twice");
    const b = await hashPassword("same-password-twice");
    expect(a).not.toBe(b);
    await expect(verifyPassword("same-password-twice", a)).resolves.toBe(true);
    await expect(verifyPassword("same-password-twice", b)).resolves.toBe(true);
  });

  it("records its parameters in the hash string", async () => {
    const hash = await hashPassword("whatever-goes-here");
    expect(hash.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(hash.split("$")).toHaveLength(6);
  });

  /**
   * A missing or corrupted ADMIN_PASSWORD_HASH must fail closed and quietly,
   * never throw — an exception here would tell an attacker that the config is
   * broken rather than that the password was wrong.
   */
  it("fails closed on a malformed stored hash instead of throwing", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$32768$8$1$deadbeef",
      "bcrypt$32768$8$1$aa$bb",
      "scrypt$abc$8$1$aa$bb",
      "scrypt$32768$8$1$$",
    ]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });
});

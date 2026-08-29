import { config } from "dotenv";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const url = process.env.DATABASE_URL ?? "";

/**
 * Drops and recreates the public schema. Destructive by design, so it refuses
 * to run against anything that looks like production.
 */
async function main() {
  if (/\.neon\.tech|neon\.build/.test(url) && process.env.ALLOW_REMOTE_RESET !== "yes") {
    console.error(
      "Refusing to reset a Neon database.\n" +
        "If you really mean it, re-run with ALLOW_REMOTE_RESET=yes",
    );
    process.exit(1);
  }

  const { createDb } = await import("./client");
  const db = createDb();
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`create schema public`);
  console.log("Schema dropped and recreated. Run: pnpm db:migrate && pnpm db:seed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});

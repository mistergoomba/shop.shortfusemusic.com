import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const migrationsFolder = resolve(import.meta.dirname, "../migrations");

async function main() {
  if (/\.neon\.tech|neon\.build/.test(url!)) {
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    if (typeof WebSocket === "undefined") {
      const ws = await import("ws");
      neonConfig.webSocketConstructor = ws.default as never;
    }
    const pool = new Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder });
    await pool.end();
  } else {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const postgres = (await import("postgres")).default;
    // A migration connection must be single-use; max: 1 avoids racing DDL.
    const client = postgres(url!, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder });
    await client.end();
  }
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import { Pool, neonConfig } from "@neondatabase/serverless";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One connection helper for two very different environments:
 *
 *   - Neon (production on Vercel) -- the serverless driver, which pools over
 *     WebSockets and survives functions being frozen and thawed.
 *   - Local Postgres in Docker    -- plain postgres.js.
 *
 * The URL decides. Nothing else in the app knows or cares which one it got.
 */

function isNeon(url: string): boolean {
  return /\.neon\.tech|neon\.build/.test(url);
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }
  return url;
}

/**
 * A single concrete database type for the whole app.
 *
 * The two drivers build identical queries, but their drizzle types are
 * distinct. Returning a union of them makes every `.returning()` and
 * `.onConflictDoNothing()` call ambiguous to TypeScript, so the Neon instance
 * is narrowed to the same shape. This is a type-level unification only --
 * both drivers really do support everything used here.
 */
export type Database = PostgresJsDatabase<typeof schema>;

export function createDb(url = connectionString()): Database {
  if (isNeon(url)) {
    // Only needed outside Vercel's runtime, which provides a native WebSocket.
    if (typeof WebSocket === "undefined") {
      neonConfig.webSocketConstructor =
        require("ws") as unknown as typeof WebSocket;
    }
    const pool = new Pool({ connectionString: url });
    return drizzleNeon(pool, {
      schema,
      casing: "snake_case",
    }) as unknown as Database;
  }

  const client = postgres(url, { max: 10 });
  return drizzlePostgres(client, { schema, casing: "snake_case" });
}

let cached: Database | undefined;

/**
 * Module-scoped singleton. In dev this survives HMR; in a warm serverless
 * function it avoids opening a new pool on every invocation.
 */
export function getDb(): Database {
  cached ??= createDb();
  return cached;
}

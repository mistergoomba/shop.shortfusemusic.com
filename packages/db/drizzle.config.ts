import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { resolve } from "node:path";

// drizzle-kit bundles this config, so import.meta.dirname is not available.
// It always runs with packages/db as cwd, so resolve the root .env from there.
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

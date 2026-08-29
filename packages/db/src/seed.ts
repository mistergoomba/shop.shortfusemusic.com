import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const { createDb } = await import("./client");
const { storeSettings, orderNumberSeq } = await import("./schema");

/**
 * Seeds only the singleton rows the app cannot boot without.
 * Catalog data comes from `pnpm import` (the Big Cartel importer), not here,
 * so this stays safe to re-run at any time.
 */
async function main() {
  const db = createDb();

  await db
    .insert(storeSettings)
    .values({
      id: 1,
      storeName: "Short Fuse",
      contactEmail: "info@shortfusemusic.com",
      shippingUsCents: 500,
      shippingCaCents: 1500,
      shippingIntlCents: 2500,
      internationalShippingEnabled: true,
      freeShippingThresholdCents: null,
    })
    .onConflictDoNothing();

  await db
    .insert(orderNumberSeq)
    .values({ id: 1, next: 1001 })
    .onConflictDoNothing();

  console.log("Seeded store settings and order counter.");
  console.log("Next: pnpm import   (loads the Big Cartel catalog)");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

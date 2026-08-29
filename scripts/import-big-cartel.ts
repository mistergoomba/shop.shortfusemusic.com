/**
 * Big Cartel -> PostgreSQL importer.
 *
 * Idempotent: every row is keyed on its Big Cartel id, so re-running updates
 * in place instead of duplicating the catalog. Images already mirrored are
 * skipped by source URL, so a re-run is cheap.
 *
 *   pnpm import                 # import catalog + mirror images
 *   pnpm import --skip-images   # catalog only, keep remote Big Cartel URLs
 *   pnpm import --dry-run       # report what would change, write nothing
 *   pnpm import --remirror      # re-download and re-point images already recorded
 */
import { config } from "dotenv";
import { resolve, extname } from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "..");
// Must run before createDb() is called; the client reads DATABASE_URL lazily.
config({ path: resolve(ROOT, ".env"), quiet: true });

import {
  createDb,
  categories,
  products,
  productSizes,
  productImages,
  eq,
} from "@sf/db";
import { bigCartelDescriptionToHtml } from "@sf/core";
import { dollarsToCents, sizeSortPosition, SIZE_LADDER } from "@sf/shared";

/* ------------------------------------------------------------------ */
/* Big Cartel export shape                                             */
/* ------------------------------------------------------------------ */

interface BcImage {
  url: string;
  width: number;
  height: number;
}
interface BcOption {
  id: number;
  name: string;
  price: number;
  sold_out: boolean;
}
interface BcOptionGroup {
  id: number;
  name: string;
}
interface BcCategory {
  id: number;
  name: string;
  permalink: string;
}
interface BcProduct {
  id: number;
  name: string;
  permalink: string;
  position: number;
  status: string;
  images: BcImage[];
  price: number;
  default_price: number;
  on_sale: boolean;
  description: string | null;
  has_option_groups: boolean;
  options: BcOption[];
  categories: BcCategory[];
  option_groups: BcOptionGroup[];
}

const args = new Set(process.argv.slice(2));
const SKIP_IMAGES = args.has("--skip-images");
const DRY_RUN = args.has("--dry-run");
/**
 * Re-download images that are already recorded and rewrite their URLs.
 *
 * Needed because a normal run skips any image whose source URL is already
 * present, which is right for re-runs but wrong after switching storage: a
 * catalog first imported with --skip-images holds remote Big Cartel URLs, and
 * without this flag a later run with a Blob token would never mirror them.
 */
const REMIRROR = args.has("--remirror");

const SOURCE = resolve(ROOT, "data/products.json");
const LOCAL_MEDIA_DIR = resolve(ROOT, "apps/web/public/media");
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN?.trim();

/* ------------------------------------------------------------------ */
/* Transformation rules                                                */
/* ------------------------------------------------------------------ */

/**
 * The order categories appear in on the homepage and in the nav, by slug.
 *
 * Only used when a category row is first created -- the upsert below never
 * overwrites `sortPosition`, so once the catalog is imported the admin screen
 * is the source of truth and re-running the importer will not undo a reorder.
 * Anything not listed here sorts after everything that is, alphabetically.
 */
const CATEGORY_ORDER = [
  "t-shirts",
  "albums",
  "headwear",
  "drinking-buddies",
  "flags",
  "tote-bags",
  "miscellaneous",
];

function categorySortPosition(slug: string): number {
  const i = CATEGORY_ORDER.indexOf(slug);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/**
 * Big Cartel categories folded into another category on import.
 *
 * The source export still has a Photos category with two products in it; the
 * band decided those belong under Miscellaneous. Without this the category
 * would be recreated and the products reassigned every time the importer runs.
 * The folded-away category is never created at all.
 */
const CATEGORY_REMAP: Record<string, string> = {
  photos: "miscellaneous",
};

function remapCategorySlug(slug: string): string {
  return CATEGORY_REMAP[slug] ?? slug;
}

/**
 * Big Cartel has no notion of "low stock", so the import can only ever
 * produce IN_STOCK or SOLD_OUT. LOW_STOCK is assigned by hand in admin.
 */
function availabilityFromStatus(status: string): "IN_STOCK" | "SOLD_OUT" {
  return status === "active" ? "IN_STOCK" : "SOLD_OUT";
}

/**
 * Size is the only variant axis we import. Products whose option group is
 * "Style" (the three trucker hats, which all carry an identical and clearly
 * bogus Gray/Green/Green Gray list) become plain sizeless products.
 */
function sizeOptionsFor(p: BcProduct): BcOption[] {
  if (!p.has_option_groups) return [];
  const isSizeGroup = p.option_groups.some((g) => g.name.toLowerCase() === "size");
  if (!isSizeGroup) return [];
  return p.options;
}

/** Normalize Big Cartel's size names onto the canonical ladder. */
function normalizeSizeLabel(raw: string): string {
  const trimmed = raw.trim();
  const match = SIZE_LADDER.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

/** Strip Big Cartel's resize query so we mirror the native-resolution file. */
function originalImageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

function fileNameFor(slug: string, index: number, sourceUrl: string): string {
  let ext = ".jpg";
  try {
    const guess = extname(new URL(sourceUrl).pathname).toLowerCase();
    if (/^\.(jpe?g|png|webp|gif|avif)$/.test(guess)) ext = guess;
  } catch {
    /* keep default */
  }
  return `${slug}-${index + 1}${ext}`;
}

/* ------------------------------------------------------------------ */
/* Image mirroring                                                     */
/* ------------------------------------------------------------------ */

type MirrorResult = { url: string; mirrored: boolean };

async function mirrorImage(
  sourceUrl: string,
  fileName: string,
): Promise<MirrorResult> {
  const full = originalImageUrl(sourceUrl);
  const res = await fetch(full);
  if (!res.ok) {
    // Fall back to the remote URL rather than failing the whole import.
    console.warn(`  ! ${fileName}: HTTP ${res.status}, keeping remote URL`);
    return { url: sourceUrl, mirrored: false };
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  if (BLOB_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`products/${fileName}`, buffer, {
      access: "public",
      token: BLOB_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: res.headers.get("content-type") ?? undefined,
    });
    return { url: blob.url, mirrored: true };
  }

  await mkdir(LOCAL_MEDIA_DIR, { recursive: true });
  await writeFile(resolve(LOCAL_MEDIA_DIR, fileName), buffer);
  return { url: `/media/${fileName}`, mirrored: true };
}

/** Run tasks with a small concurrency cap so we do not hammer the CDN. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`No catalog export at ${SOURCE}`);
    process.exit(1);
  }

  const raw = await readFile(SOURCE, "utf8");
  const catalog = JSON.parse(raw) as BcProduct[];
  console.log(`Read ${catalog.length} products from data/products.json`);
  if (DRY_RUN) console.log("DRY RUN - nothing will be written\n");
  if (!SKIP_IMAGES && !BLOB_TOKEN) {
    console.log("No BLOB_READ_WRITE_TOKEN set; mirroring to apps/web/public/media/\n");
  }

  const db = createDb();

  const stats = {
    categories: 0,
    productsCreated: 0,
    productsUpdated: 0,
    sizes: 0,
    imagesMirrored: 0,
    imagesRewritten: 0,
    imagesSkipped: 0,
    styleGroupsDropped: 0,
    saleFlagsIgnored: 0,
  };

  /* ---- Categories ---- */
  const bcCategories = new Map<number, BcCategory>();
  for (const p of catalog) {
    for (const c of p.categories) {
      // A remapped category is never created; its products are reassigned
      // to the target below.
      if (CATEGORY_REMAP[c.permalink]) continue;
      bcCategories.set(c.id, c);
    }
  }

  const categoryIdBySlug = new Map<string, number>();
  // Sorted by the intended display order, then by name for anything the
  // CATEGORY_ORDER list does not mention.
  const sortedCategories = [...bcCategories.values()].sort(
    (a, b) =>
      categorySortPosition(a.permalink) - categorySortPosition(b.permalink) ||
      a.name.localeCompare(b.name),
  );

  for (const c of sortedCategories) {
    if (DRY_RUN) {
      console.log(
        `  category: ${c.name} (${c.permalink}) sort=${categorySortPosition(c.permalink)}`,
      );
      stats.categories++;
      continue;
    }
    const [row] = await db
      .insert(categories)
      .values({
        name: c.name,
        slug: c.permalink,
        sortPosition: categorySortPosition(c.permalink),
        active: true,
        bigCartelId: c.id,
      })
      .onConflictDoUpdate({
        target: categories.bigCartelId,
        set: { name: c.name, slug: c.permalink, updatedAt: new Date() },
      })
      .returning({ id: categories.id });
    categoryIdBySlug.set(c.permalink, row!.id);
    stats.categories++;
  }

  /* ---- Products ---- */
  for (const p of catalog) {
    const availability = availabilityFromStatus(p.status);
    const description = bigCartelDescriptionToHtml(p.description);
    const priceCents = dollarsToCents(p.price);

    // The export's on_sale flag is unusable: every flagged product has
    // price === default_price, so there is no original price to strike
    // through. Import at face value and let the admin set real sale prices.
    if (p.on_sale) stats.saleFlagsIgnored++;

    const hasStyleGroup =
      p.has_option_groups &&
      p.option_groups.some((g) => g.name.toLowerCase() !== "size");
    if (hasStyleGroup) stats.styleGroupsDropped++;

    const bcCategory = p.categories[0];
    const categoryId = bcCategory
      ? (categoryIdBySlug.get(remapCategorySlug(bcCategory.permalink)) ?? null)
      : null;

    const sizeOptions = sizeOptionsFor(p);

    if (DRY_RUN) {
      console.log(
        `  product: ${p.name} $${p.price} ${availability}` +
          ` sizes=${sizeOptions.length} images=${p.images.length}` +
          (hasStyleGroup ? "  [dropping Style options]" : ""),
      );
      continue;
    }

    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.bigCartelId, p.id))
      .limit(1);

    const values = {
      name: p.name,
      slug: p.permalink,
      description,
      priceCents,
      salePriceCents: null,
      categoryId,
      availability,
      active: true,
      sortPosition: p.position,
      bigCartelId: p.id,
      updatedAt: new Date(),
    };

    let productId: number;
    if (existing.length > 0) {
      productId = existing[0]!.id;
      // `featured` is deliberately not overwritten -- it is an editorial
      // choice made in admin, not something Big Cartel knows about.
      await db.update(products).set(values).where(eq(products.id, productId));
      stats.productsUpdated++;
    } else {
      const [row] = await db
        .insert(products)
        .values(values)
        .returning({ id: products.id });
      productId = row!.id;
      stats.productsCreated++;
    }

    /* ---- Sizes ---- */
    for (const opt of sizeOptions) {
      const label = normalizeSizeLabel(opt.name);
      // Every option in the export carries sold_out: false, including on
      // products the store itself marks sold out -- so the option flag is
      // useless and size availability is derived from the product instead.
      await db
        .insert(productSizes)
        .values({
          productId,
          label,
          availability,
          sortPosition: sizeSortPosition(label),
        })
        .onConflictDoUpdate({
          target: [productSizes.productId, productSizes.label],
          set: { sortPosition: sizeSortPosition(label) },
        });
      stats.sizes++;
    }

    /* ---- Images ---- */
    if (p.images.length > 0) {
      const existingImages = await db
        .select({ id: productImages.id, sourceUrl: productImages.sourceUrl })
        .from(productImages)
        .where(eq(productImages.productId, productId));
      const bySource = new Map(
        existingImages.filter((r) => r.sourceUrl).map((r) => [r.sourceUrl!, r.id]),
      );

      await mapLimit(p.images, 4, async (img, index) => {
        const existingId = bySource.get(img.url);

        if (existingId !== undefined && !(REMIRROR && !SKIP_IMAGES)) {
          stats.imagesSkipped++;
          return;
        }

        let url = img.url;
        if (!SKIP_IMAGES) {
          const fileName = fileNameFor(p.permalink, index, img.url);
          const result = await mirrorImage(img.url, fileName);
          url = result.url;
          if (result.mirrored) stats.imagesMirrored++;
        }

        // Alt text has to say something useful for screen readers; the product
        // name plus position is the best we can derive.
        const alt = index === 0 ? p.name : `${p.name} — view ${index + 1}`;

        if (existingId !== undefined) {
          // Re-mirroring: keep the row (and anything referencing it), just
          // point it at the new storage.
          await db
            .update(productImages)
            .set({ url, alt, sortPosition: index })
            .where(eq(productImages.id, existingId));
          stats.imagesRewritten++;
          return;
        }

        await db.insert(productImages).values({
          productId,
          url,
          alt,
          width: img.width,
          height: img.height,
          sortPosition: index,
          sourceUrl: img.url,
        });
      });
    }
  }

  console.log("\n--- Import summary ---");
  console.log(`  categories:        ${stats.categories}`);
  console.log(`  products created:  ${stats.productsCreated}`);
  console.log(`  products updated:  ${stats.productsUpdated}`);
  console.log(`  sizes:             ${stats.sizes}`);
  console.log(`  images mirrored:   ${stats.imagesMirrored}`);
  console.log(`  images rewritten:  ${stats.imagesRewritten}`);
  console.log(`  images skipped:    ${stats.imagesSkipped} (already present)`);
  console.log(`  Style groups dropped: ${stats.styleGroupsDropped}`);
  console.log(`  unusable on_sale flags ignored: ${stats.saleFlagsIgnored}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});

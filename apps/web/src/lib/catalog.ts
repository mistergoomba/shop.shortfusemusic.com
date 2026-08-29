import "server-only";
import { cache } from "react";
import {
  getDb,
  categories,
  products,
  productSizes,
  productImages,
  relatedProducts,
  storeSettings,
  cartOffers,
  eq,
  and,
  asc,
  inArray,
} from "@sf/db";
import type {
  AuthoritativeOffer,
  AuthoritativeProduct,
  ShippingSettings,
} from "@sf/core";
import { buildRelatedProducts } from "@sf/core";
import { isPurchasable, type Availability } from "@sf/shared";

/* ------------------------------------------------------------------ */
/* View models                                                         */
/* ------------------------------------------------------------------ */

export interface ImageView {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface SizeView {
  id: number;
  label: string;
  availability: Availability;
}

export interface ProductCardView {
  id: number;
  name: string;
  slug: string;
  priceCents: number;
  salePriceCents: number | null;
  availability: Availability;
  featured: boolean;
  /** Always true for anything these queries return; carried so that the
      related-products rule in @sf/core can be applied without a re-fetch. */
  active: boolean;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  images: ImageView[];
  sizes: SizeView[];
}

export interface ProductDetailView extends ProductCardView {
  description: string | null;
  updatedAt: Date;
}

export interface CategoryView {
  id: number;
  name: string;
  slug: string;
  sortPosition: number;
}

/**
 * A product is buyable if anything about it can be added to a cart: for a
 * sized product that means at least one size is in stock, not merely that the
 * product row says IN_STOCK.
 */
export function isProductBuyable(p: {
  availability: Availability;
  sizes: { availability: Availability }[];
}): boolean {
  if (p.sizes.length > 0) return p.sizes.some((s) => isPurchasable(s.availability));
  return isPurchasable(p.availability);
}

/** Does the product show a LOW STOCK treatment? */
export function isLowStock(p: {
  availability: Availability;
  sizes: { availability: Availability }[];
}): boolean {
  if (p.sizes.length > 0) {
    const buyable = p.sizes.filter((s) => isPurchasable(s.availability));
    return buyable.length > 0 && buyable.every((s) => s.availability === "LOW_STOCK");
  }
  return p.availability === "LOW_STOCK";
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

// `as const` on the whole object would make orderBy a readonly tuple, which
// drizzle rejects; a bare `true` widens to boolean, which it also rejects.
// So: mutable arrays, pinned literal.
const PRODUCT_WITH = {
  images: { orderBy: [asc(productImages.sortPosition)] },
  sizes: { orderBy: [asc(productSizes.sortPosition)] },
  category: true as const,
};

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  salePriceCents: number | null;
  availability: Availability;
  featured: boolean;
  active: boolean;
  categoryId: number | null;
  updatedAt: Date;
  images: { url: string; alt: string | null; width: number | null; height: number | null }[];
  sizes: { id: number; label: string; availability: Availability }[];
  category: { id: number; name: string; slug: string } | null;
};

function toDetail(row: ProductRow): ProductDetailView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    priceCents: row.priceCents,
    salePriceCents: row.salePriceCents,
    availability: row.availability,
    featured: row.featured,
    active: row.active,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    images: row.images,
    sizes: row.sizes,
    updatedAt: row.updatedAt,
  };
}

export const getCategories = cache(async (): Promise<CategoryView[]> => {
  const db = getDb();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortPosition: categories.sortPosition,
    })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sortPosition), asc(categories.name));
  return rows;
});

export const getAllProducts = cache(async (): Promise<ProductCardView[]> => {
  const db = getDb();
  const rows = (await db.query.products.findMany({
    where: eq(products.active, true),
    with: PRODUCT_WITH,
    orderBy: [asc(products.sortPosition), asc(products.id)],
  })) as unknown as ProductRow[];
  return rows.map(toDetail);
});

/** Fisher-Yates. Returns a new array; does not touch the input. */
function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The FEATURED row.
 *
 * Anything explicitly marked featured in admin is shown in the admin's own
 * order, exactly and predictably. Randomising a hand-picked set only shuffles
 * the order it appears in, which is not variety -- it is just an editorial
 * decision the band cannot rely on.
 *
 * The shuffle survives only for the fallback case: with nothing marked
 * featured (the state right after an import) the row draws at random from the
 * whole purchasable catalog, so the homepage still has a top section rather
 * than an empty gap.
 *
 * Sold-out products are excluded either way -- the top of the homepage is the
 * worst place to advertise something nobody can buy.
 *
 * Note the homepage is statically rendered with `revalidate = 300`, so the
 * fallback's randomness only re-rolls every five minutes, not per visitor.
 */
export const getFeaturedProducts = cache(
  async (limit = 8): Promise<ProductCardView[]> => {
    const db = getDb();
    const rows = (await db.query.products.findMany({
      where: and(eq(products.active, true), eq(products.featured, true)),
      with: PRODUCT_WITH,
      orderBy: [asc(products.sortPosition), asc(products.id)],
    })) as unknown as ProductRow[];

    const curated = rows.map(toDetail).filter(isProductBuyable);
    if (curated.length > 0) return curated.slice(0, limit);

    const all = await getAllProducts();
    return shuffle(all.filter(isProductBuyable)).slice(0, limit);
  },
);

export const getCategoryBySlug = cache(
  async (slug: string): Promise<CategoryView | null> => {
    const db = getDb();
    const [row] = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        sortPosition: categories.sortPosition,
      })
      .from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.active, true)))
      .limit(1);
    return row ?? null;
  },
);

export const getProductsByCategory = cache(
  async (categoryId: number): Promise<ProductCardView[]> => {
    const db = getDb();
    const rows = (await db.query.products.findMany({
      where: and(eq(products.active, true), eq(products.categoryId, categoryId)),
      with: PRODUCT_WITH,
      orderBy: [asc(products.sortPosition), asc(products.id)],
    })) as unknown as ProductRow[];
    return rows.map(toDetail);
  },
);

export const getProductBySlug = cache(
  async (slug: string): Promise<ProductDetailView | null> => {
    const db = getDb();
    const row = (await db.query.products.findFirst({
      where: and(eq(products.slug, slug), eq(products.active, true)),
      with: PRODUCT_WITH,
    })) as unknown as ProductRow | undefined;
    return row ? toDetail(row) : null;
  },
);

/**
 * "YOU MIGHT ALSO DIG": curated picks first, then same-category backfill.
 * The ordering rule itself lives in @sf/core so it can be unit-tested.
 */
export const getRelatedProducts = cache(
  async (product: ProductDetailView, limit = 4): Promise<ProductCardView[]> => {
    const db = getDb();

    const curatedRows = await db
      .select({ relatedId: relatedProducts.relatedProductId })
      .from(relatedProducts)
      .where(eq(relatedProducts.productId, product.id))
      .orderBy(asc(relatedProducts.sortPosition));

    const curatedIds = curatedRows.map((r) => r.relatedId);

    const curated: ProductCardView[] = [];
    if (curatedIds.length > 0) {
      const rows = (await db.query.products.findMany({
        where: and(eq(products.active, true), inArray(products.id, curatedIds)),
        with: PRODUCT_WITH,
      })) as unknown as ProductRow[];
      const byId = new Map(rows.map((r) => [r.id, toDetail(r)]));
      // Preserve the admin's ordering, which the IN query does not guarantee.
      for (const id of curatedIds) {
        const found = byId.get(id);
        if (found) curated.push(found);
      }
    }

    const pool =
      product.categoryId === null
        ? []
        : await getProductsByCategory(product.categoryId);

    return buildRelatedProducts<ProductCardView>(product, curated, pool, limit);
  },
);

/* ------------------------------------------------------------------ */
/* Authoritative reads for pricing                                     */
/* ------------------------------------------------------------------ */

/**
 * Loads exactly the products a cart references, in the shape the pricing
 * engine expects. Called immediately before every price calculation and every
 * checkout so that nothing is served from a stale cache.
 */
export async function loadAuthoritativeProducts(
  ids: number[],
): Promise<Map<number, AuthoritativeProduct>> {
  if (ids.length === 0) return new Map();
  const db = getDb();
  const rows = (await db.query.products.findMany({
    where: inArray(products.id, ids),
    with: {
      sizes: { orderBy: [asc(productSizes.sortPosition)] },
      images: { orderBy: [asc(productImages.sortPosition)], limit: 1 },
    },
  })) as unknown as (ProductRow & { active: boolean })[];

  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        slug: r.slug,
        priceCents: r.priceCents,
        salePriceCents: r.salePriceCents,
        categoryId: r.categoryId,
        availability: r.availability,
        active: r.active,
        sizes: r.sizes,
        primaryImageUrl: r.images[0]?.url ?? null,
      } satisfies AuthoritativeProduct,
    ]),
  );
}

export async function loadActiveOffers(): Promise<AuthoritativeOffer[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cartOffers)
    .where(eq(cartOffers.active, true))
    .orderBy(asc(cartOffers.sortPosition), asc(cartOffers.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    productId: r.productId,
    offerPriceCents: r.offerPriceCents,
    active: r.active,
    triggerType: r.triggerType,
    triggerProductId: r.triggerProductId,
    triggerCategoryId: r.triggerCategoryId,
    minimumSubtotalCents: r.minimumSubtotalCents,
    sortPosition: r.sortPosition,
  }));
}

export const getStoreSettings = cache(async () => {
  const db = getDb();
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1));
  if (!row) {
    throw new Error("Store settings row is missing. Run: pnpm db:seed");
  }
  return row;
});

export async function getShippingSettings(): Promise<ShippingSettings> {
  const s = await getStoreSettings();
  return {
    shippingUsCents: s.shippingUsCents,
    shippingCaCents: s.shippingCaCents,
    shippingIntlCents: s.shippingIntlCents,
    internationalShippingEnabled: s.internationalShippingEnabled,
    freeShippingThresholdCents: s.freeShippingThresholdCents,
  };
}

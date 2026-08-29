import "server-only";
import {
  getDb,
  categories,
  products,
  productSizes,
  productImages,
  relatedProducts,
  cartOffers,
  orders,
  orderItems,
  storeSettings,
  eq,
  and,
  or,
  asc,
  desc,
  inArray,
  count,
  sql,
} from "@sf/db";
import type { Availability, OrderStatus } from "@sf/shared";

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export async function getDashboard() {
  const db = getDb();

  const [recentOrders, unshipped, lowStockProducts, lowStockSizes, counts] =
    await Promise.all([
      db.query.orders.findMany({
        orderBy: [desc(orders.createdAt)],
        limit: 8,
        with: { items: true },
      }),

      // Paid but not yet shipped: the actual work queue.
      db.query.orders.findMany({
        where: eq(orders.status, "PAID"),
        orderBy: [asc(orders.paidAt)],
        limit: 25,
      }),

      db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          availability: products.availability,
        })
        .from(products)
        .where(and(eq(products.active, true), eq(products.availability, "LOW_STOCK")))
        .orderBy(asc(products.name)),

      db
        .select({
          productId: products.id,
          productName: products.name,
          slug: products.slug,
          label: productSizes.label,
          availability: productSizes.availability,
        })
        .from(productSizes)
        .innerJoin(products, eq(products.id, productSizes.productId))
        .where(
          and(eq(products.active, true), eq(productSizes.availability, "LOW_STOCK")),
        )
        .orderBy(asc(products.name), asc(productSizes.sortPosition)),

      db
        .select({
          status: orders.status,
          n: count(),
          revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
        })
        .from(orders)
        .groupBy(orders.status),
    ]);

  const byStatus = new Map(counts.map((c) => [c.status, c]));
  const paidRevenue =
    (byStatus.get("PAID")?.revenue ?? 0) + (byStatus.get("SHIPPED")?.revenue ?? 0);

  return {
    recentOrders,
    unshipped,
    lowStockProducts,
    lowStockSizes,
    stats: {
      pending: byStatus.get("PENDING")?.n ?? 0,
      paid: byStatus.get("PAID")?.n ?? 0,
      shipped: byStatus.get("SHIPPED")?.n ?? 0,
      refunded: byStatus.get("REFUNDED")?.n ?? 0,
      revenueCents: paidRevenue,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface ProductFilter {
  q?: string;
  categoryId?: number;
  status?: "active" | "inactive" | "sold_out" | "featured";
}

export async function listProducts(filter: ProductFilter = {}) {
  const db = getDb();

  const conditions = [];
  if (filter.q) {
    conditions.push(
      or(
        sql`${products.name} ilike ${`%${filter.q}%`}`,
        sql`${products.slug} ilike ${`%${filter.q}%`}`,
      ),
    );
  }
  if (filter.categoryId) conditions.push(eq(products.categoryId, filter.categoryId));
  if (filter.status === "active") conditions.push(eq(products.active, true));
  if (filter.status === "inactive") conditions.push(eq(products.active, false));
  if (filter.status === "featured") conditions.push(eq(products.featured, true));
  if (filter.status === "sold_out") {
    conditions.push(eq(products.availability, "SOLD_OUT"));
  }

  return db.query.products.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      category: true,
      sizes: { orderBy: [asc(productSizes.sortPosition)] },
      images: { orderBy: [asc(productImages.sortPosition)], limit: 1 },
    },
    orderBy: [asc(products.sortPosition), asc(products.id)],
  });
}

export async function getProductForEdit(id: number) {
  const db = getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      category: true,
      sizes: { orderBy: [asc(productSizes.sortPosition)] },
      images: { orderBy: [asc(productImages.sortPosition)] },
    },
  });
  if (!product) return null;

  const related = await db
    .select({
      id: products.id,
      name: products.name,
      sortPosition: relatedProducts.sortPosition,
    })
    .from(relatedProducts)
    .innerJoin(products, eq(products.id, relatedProducts.relatedProductId))
    .where(eq(relatedProducts.productId, id))
    .orderBy(asc(relatedProducts.sortPosition));

  return { ...product, related };
}

/** Lightweight list for the related-products and offer pickers. */
export async function listProductOptions() {
  const db = getDb();
  return db
    .select({ id: products.id, name: products.name, active: products.active })
    .from(products)
    .orderBy(asc(products.name));
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export async function listCategories() {
  const db = getDb();
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortPosition: categories.sortPosition,
      active: categories.active,
      productCount: sql<number>`(
        select count(*)::int from ${products} where ${products.categoryId} = ${categories.id}
      )`,
    })
    .from(categories)
    .orderBy(asc(categories.sortPosition), asc(categories.name));
}

/* ------------------------------------------------------------------ */
/* Cart offers                                                         */
/* ------------------------------------------------------------------ */

export async function listOffers() {
  const db = getDb();
  return db.query.cartOffers.findMany({
    with: { product: true, triggerProduct: true, triggerCategory: true },
    orderBy: [asc(cartOffers.sortPosition), asc(cartOffers.id)],
  });
}

export async function getOffer(id: number) {
  const db = getDb();
  return (
    (await db.query.cartOffers.findFirst({ where: eq(cartOffers.id, id) })) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export async function listOrders(status?: OrderStatus) {
  const db = getDb();
  return db.query.orders.findMany({
    where: status ? eq(orders.status, status) : undefined,
    orderBy: [desc(orders.createdAt)],
    limit: 200,
    with: { items: { orderBy: [asc(orderItems.id)] } },
  });
}

export async function getOrder(id: number) {
  const db = getDb();
  return (
    (await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: { orderBy: [asc(orderItems.id)] } },
    })) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function getSettings() {
  const db = getDb();
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1));
  if (!row) throw new Error("Store settings row is missing. Run: pnpm db:seed");
  return row;
}

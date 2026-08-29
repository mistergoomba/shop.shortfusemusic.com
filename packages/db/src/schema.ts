import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { AVAILABILITY, OFFER_TRIGGER, ORDER_STATUS, SHIPPING_ZONE } from "@sf/shared";

export const availabilityEnum = pgEnum("availability", AVAILABILITY);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUS);
export const offerTriggerEnum = pgEnum("offer_trigger", OFFER_TRIGGER);
export const shippingZoneEnum = pgEnum("shipping_zone", SHIPPING_ZONE);

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    sortPosition: integer("sort_position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    /** Set by the Big Cartel importer; makes re-runs update instead of duplicate. */
    bigCartelId: integer("big_cartel_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("categories_slug_key").on(t.slug),
    uniqueIndex("categories_big_cartel_id_key").on(t.bigCartelId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    /** Sanitized HTML. Sanitized again at render; never trusted raw. */
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    salePriceCents: integer("sale_price_cents"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    /**
     * Product-level availability. For a product WITH sizes this is a rollup
     * used for badges and filtering; the authoritative per-size state lives
     * on product_sizes and is what checkout actually validates against.
     */
    availability: availabilityEnum("availability").notNull().default("IN_STOCK"),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortPosition: integer("sort_position").notNull().default(0),
    bigCartelId: integer("big_cartel_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    uniqueIndex("products_big_cartel_id_key").on(t.bigCartelId),
    index("products_category_idx").on(t.categoryId),
    index("products_active_sort_idx").on(t.active, t.sortPosition),
  ],
);

/**
 * Size is the ONLY supported variant axis, deliberately. Different colours or
 * styles are separate products. See seed spec section 4.
 */
export const productSizes = pgTable(
  "product_sizes",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 40 }).notNull(),
    availability: availabilityEnum("availability").notNull().default("IN_STOCK"),
    sortPosition: integer("sort_position").notNull().default(0),
  },
  (t) => [
    uniqueIndex("product_sizes_product_label_key").on(t.productId, t.label),
    index("product_sizes_product_idx").on(t.productId),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 2048 }).notNull(),
    alt: varchar("alt", { length: 300 }),
    width: integer("width"),
    height: integer("height"),
    /** Position 0 is the primary image. No separate isPrimary flag to drift. */
    sortPosition: integer("sort_position").notNull().default(0),
    /** Original Big Cartel URL, kept so the mirror step is re-runnable. */
    sourceUrl: varchar("source_url", { length: 2048 }),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.sortPosition)],
);

/**
 * Manually curated "YOU MIGHT ALSO DIG" list. A real ordered join table
 * rather than a JSON blob of ids, so it can be queried and FK-enforced.
 */
export const relatedProducts = pgTable(
  "related_products",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    relatedProductId: integer("related_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sortPosition: integer("sort_position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.relatedProductId] }),
    index("related_products_product_idx").on(t.productId, t.sortPosition),
  ],
);

/* ------------------------------------------------------------------ */
/* Cart offers                                                         */
/* ------------------------------------------------------------------ */

export const cartOffers = pgTable(
  "cart_offers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    offerPriceCents: integer("offer_price_cents").notNull(),
    active: boolean("active").notNull().default(true),
    triggerType: offerTriggerEnum("trigger_type").notNull().default("ALWAYS"),
    triggerProductId: integer("trigger_product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    triggerCategoryId: integer("trigger_category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    minimumSubtotalCents: integer("minimum_subtotal_cents"),
    sortPosition: integer("sort_position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cart_offers_active_idx").on(t.active, t.sortPosition)],
);

/* ------------------------------------------------------------------ */
/* Store settings (single row, id = 1)                                 */
/* ------------------------------------------------------------------ */

export const storeSettings = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: varchar("store_name", { length: 120 }).notNull().default("Short Fuse"),
  contactEmail: varchar("contact_email", { length: 320 })
    .notNull()
    .default("info@shortfusemusic.com"),
  shippingUsCents: integer("shipping_us_cents").notNull().default(500),
  shippingCaCents: integer("shipping_ca_cents").notNull().default(1500),
  shippingIntlCents: integer("shipping_intl_cents").notNull().default(2500),
  internationalShippingEnabled: boolean("international_shipping_enabled")
    .notNull()
    .default(true),
  /** null = no free shipping offer. */
  freeShippingThresholdCents: integer("free_shipping_threshold_cents"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    /** Human-friendly, shown to the customer, e.g. "SF-1042". */
    orderNumber: varchar("order_number", { length: 20 }).notNull(),
    /**
     * Unguessable token for the public order-status URL, so /order/:ref is
     * not enumerable the way a sequential id would be.
     */
    publicRef: varchar("public_ref", { length: 40 }).notNull(),
    status: orderStatusEnum("status").notNull().default("PENDING"),

    email: varchar("email", { length: 320 }).notNull(),
    customerName: varchar("customer_name", { length: 200 }),

    shipName: varchar("ship_name", { length: 200 }),
    shipLine1: varchar("ship_line1", { length: 300 }),
    shipLine2: varchar("ship_line2", { length: 300 }),
    shipCity: varchar("ship_city", { length: 150 }),
    shipState: varchar("ship_state", { length: 150 }),
    shipPostalCode: varchar("ship_postal_code", { length: 40 }),
    shipCountry: varchar("ship_country", { length: 2 }),

    shippingZone: shippingZoneEnum("shipping_zone").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull(),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    stripeRefundId: varchar("stripe_refund_id", { length: 255 }),

    trackingNumber: varchar("tracking_number", { length: 120 }),
    internalNotes: text("internal_notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("orders_order_number_key").on(t.orderNumber),
    uniqueIndex("orders_public_ref_key").on(t.publicRef),
    uniqueIndex("orders_stripe_session_key").on(t.stripeCheckoutSessionId),
    index("orders_status_created_idx").on(t.status, t.createdAt),
  ],
);

/**
 * Full snapshot of what was bought. Never join back to `products` to render
 * a historical order -- names and prices change, receipts must not.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Nullable: a deleted product must not delete order history. */
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 200 }).notNull(),
    productSlug: varchar("product_slug", { length: 200 }).notNull(),
    sizeLabel: varchar("size_label", { length: 40 }),
    imageUrl: varchar("image_url", { length: 2048 }),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    /** True when this line came from an accepted cart offer. */
    isOffer: boolean("is_offer").notNull().default(false),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/**
 * Stripe webhook idempotency ledger. A unique event id means a redelivered
 * event is a no-op insert conflict rather than a double-fulfilled order.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 120 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_stripe_event_id_key").on(t.stripeEventId)],
);

/** Monotonic counter backing the human-friendly order number. */
export const orderNumberSeq = pgTable("order_number_seq", {
  id: integer("id").primaryKey().default(1),
  next: integer("next").notNull().default(1001),
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  sizes: many(productSizes),
  images: many(productImages),
  related: many(relatedProducts, { relationName: "productRelated" }),
}));

export const productSizesRelations = relations(productSizes, ({ one }) => ({
  product: one(products, {
    fields: [productSizes.productId],
    references: [products.id],
  }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const relatedProductsRelations = relations(relatedProducts, ({ one }) => ({
  product: one(products, {
    fields: [relatedProducts.productId],
    references: [products.id],
    relationName: "productRelated",
  }),
  related: one(products, {
    fields: [relatedProducts.relatedProductId],
    references: [products.id],
    relationName: "relatedProduct",
  }),
}));

export const cartOffersRelations = relations(cartOffers, ({ one }) => ({
  product: one(products, {
    fields: [cartOffers.productId],
    references: [products.id],
  }),
  triggerProduct: one(products, {
    fields: [cartOffers.triggerProductId],
    references: [products.id],
  }),
  triggerCategory: one(categories, {
    fields: [cartOffers.triggerCategoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

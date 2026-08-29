import { z } from "zod";
import { AVAILABILITY, OFFER_TRIGGER, ORDER_STATUS } from "./enums";

/* ------------------------------------------------------------------ */
/* Cart                                                                */
/* ------------------------------------------------------------------ */

/**
 * What the browser is allowed to tell us about a cart line: *what* they want,
 * never *what it costs*. Prices are re-read from the database on every
 * validation and checkout call.
 */
export const cartLineInput = z.object({
  productId: z.number().int().positive(),
  sizeId: z.number().int().positive().nullable().default(null),
  quantity: z.number().int().min(1).max(99),
});
export type CartLineInput = z.infer<typeof cartLineInput>;

export const cartInput = z.object({
  lines: z.array(cartLineInput).max(50),
  /** Offer the customer accepted in the "WHILE YOU'RE HERE..." strip. */
  acceptedOfferId: z.number().int().positive().nullable().default(null),
  /** ISO 3166-1 alpha-2. Drives the shipping zone. */
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .nullable()
    .default(null),
});
export type CartInput = z.infer<typeof cartInput>;

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export const checkoutSessionInput = z.object({
  lines: z.array(cartLineInput).min(1).max(50),
  acceptedOfferId: z.number().int().positive().nullable().default(null),
  email: z.email().max(320),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase()),
});
export type CheckoutSessionInput = z.infer<typeof checkoutSessionInput>;

/* ------------------------------------------------------------------ */
/* Admin: products                                                     */
/* ------------------------------------------------------------------ */

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

export const availabilitySchema = z.enum(AVAILABILITY);

export const productSizeInput = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().min(1).max(40),
  availability: availabilitySchema,
});

export const productImageInput = z.object({
  id: z.number().int().positive().optional(),
  url: z.string().trim().min(1).max(2048),
  alt: z.string().trim().max(300).nullable().default(null),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
});

export const productInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: z.string().max(20000).nullable().default(null),
    priceCents: z.number().int().min(0).max(10_000_00),
    salePriceCents: z.number().int().min(0).max(10_000_00).nullable().default(null),
    categoryId: z.number().int().positive().nullable().default(null),
    availability: availabilitySchema,
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    sortPosition: z.number().int().default(0),
    sizes: z.array(productSizeInput).max(20).default([]),
    images: z.array(productImageInput).max(20).default([]),
    relatedProductIds: z.array(z.number().int().positive()).max(12).default([]),
  })
  .refine((p) => p.salePriceCents === null || p.salePriceCents < p.priceCents, {
    message: "Sale price must be lower than the regular price",
    path: ["salePriceCents"],
  });
export type ProductInput = z.infer<typeof productInput>;

/* ------------------------------------------------------------------ */
/* Admin: categories                                                   */
/* ------------------------------------------------------------------ */

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(100),
  slug: slugSchema,
  sortPosition: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInput>;

/* ------------------------------------------------------------------ */
/* Admin: cart offers                                                  */
/* ------------------------------------------------------------------ */

export const cartOfferInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    productId: z.number().int().positive(),
    offerPriceCents: z.number().int().min(0).max(10_000_00),
    active: z.boolean().default(true),
    triggerType: z.enum(OFFER_TRIGGER),
    triggerProductId: z.number().int().positive().nullable().default(null),
    triggerCategoryId: z.number().int().positive().nullable().default(null),
    minimumSubtotalCents: z.number().int().min(0).nullable().default(null),
    sortPosition: z.number().int().default(0),
  })
  .superRefine((o, ctx) => {
    // Each trigger type requires exactly the field it reads. Enforced here so
    // an offer can never reach the eligibility check in an unusable state.
    if (o.triggerType === "CONTAINS_PRODUCT" && o.triggerProductId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["triggerProductId"],
        message: "Pick the product that triggers this offer",
      });
    }
    if (o.triggerType === "CONTAINS_CATEGORY" && o.triggerCategoryId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["triggerCategoryId"],
        message: "Pick the category that triggers this offer",
      });
    }
    if (o.triggerType === "MINIMUM_SUBTOTAL" && o.minimumSubtotalCents === null) {
      ctx.addIssue({
        code: "custom",
        path: ["minimumSubtotalCents"],
        message: "Set the subtotal this offer unlocks at",
      });
    }
  });
export type CartOfferInput = z.infer<typeof cartOfferInput>;

/* ------------------------------------------------------------------ */
/* Admin: store settings                                               */
/* ------------------------------------------------------------------ */

export const storeSettingsInput = z.object({
  storeName: z.string().trim().min(1).max(120),
  contactEmail: z.email().max(320),
  shippingUsCents: z.number().int().min(0).max(1_000_00),
  shippingCaCents: z.number().int().min(0).max(1_000_00),
  shippingIntlCents: z.number().int().min(0).max(1_000_00),
  internationalShippingEnabled: z.boolean(),
  freeShippingThresholdCents: z.number().int().min(0).nullable().default(null),
});
export type StoreSettingsInput = z.infer<typeof storeSettingsInput>;

/* ------------------------------------------------------------------ */
/* Admin: orders                                                       */
/* ------------------------------------------------------------------ */

export const orderStatusSchema = z.enum(ORDER_STATUS);

export const orderUpdateInput = z.object({
  trackingNumber: z.string().trim().max(120).nullable().optional(),
  internalNotes: z.string().trim().max(5000).nullable().optional(),
});
export type OrderUpdateInput = z.infer<typeof orderUpdateInput>;

export const adminLoginInput = z.object({
  password: z.string().min(1).max(200),
});

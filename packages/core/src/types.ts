import type { Availability, OfferTrigger, ShippingZone } from "@sf/shared";

/**
 * The authoritative shape the pricing engine works from. Every field here is
 * read fresh from the database immediately before pricing -- none of it ever
 * originates in the browser.
 */
export interface AuthoritativeSize {
  id: number;
  label: string;
  availability: Availability;
}

export interface AuthoritativeProduct {
  id: number;
  name: string;
  slug: string;
  priceCents: number;
  salePriceCents: number | null;
  categoryId: number | null;
  availability: Availability;
  active: boolean;
  sizes: AuthoritativeSize[];
  primaryImageUrl: string | null;
}

export interface AuthoritativeOffer {
  id: number;
  name: string;
  productId: number;
  offerPriceCents: number;
  active: boolean;
  triggerType: OfferTrigger;
  triggerProductId: number | null;
  triggerCategoryId: number | null;
  minimumSubtotalCents: number | null;
  sortPosition: number;
}

export interface ShippingSettings {
  shippingUsCents: number;
  shippingCaCents: number;
  shippingIntlCents: number;
  internationalShippingEnabled: boolean;
  freeShippingThresholdCents: number | null;
}

/** Machine-readable reasons a line or cart was rejected. */
export type CartIssueCode =
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_SOLD_OUT"
  | "SIZE_REQUIRED"
  | "SIZE_NOT_FOUND"
  | "SIZE_SOLD_OUT"
  | "SIZE_NOT_APPLICABLE"
  | "OFFER_NOT_FOUND"
  | "OFFER_INACTIVE"
  | "OFFER_NOT_ELIGIBLE"
  | "OFFER_PRODUCT_UNAVAILABLE"
  | "EMPTY_CART"
  | "INTERNATIONAL_DISABLED"
  | "COUNTRY_REQUIRED";

export interface CartIssue {
  code: CartIssueCode;
  message: string;
  productId?: number;
  sizeId?: number;
  offerId?: number;
}

export interface PricedLine {
  productId: number;
  sizeId: number | null;
  name: string;
  slug: string;
  sizeLabel: string | null;
  imageUrl: string | null;
  /** Price actually charged per unit, after any product-level sale price. */
  unitPriceCents: number;
  /** The pre-sale price, present only when this line is on sale. */
  compareAtCents: number | null;
  quantity: number;
  lineTotalCents: number;
  isOffer: boolean;
  availability: Availability;
}

export interface PricedCart {
  lines: PricedLine[];
  /** Merchandise total at undiscounted prices, including any offer line. */
  subtotalCents: number;
  /** Savings from an accepted cart offer. */
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingZone: ShippingZone | null;
  freeShippingApplied: boolean;
  /** How much more merchandise unlocks free shipping, when configured. */
  amountToFreeShippingCents: number | null;
  appliedOfferId: number | null;
  issues: CartIssue[];
}

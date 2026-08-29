export const AVAILABILITY = ["IN_STOCK", "LOW_STOCK", "SOLD_OUT"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Can this availability state actually be added to a cart? */
export function isPurchasable(a: Availability): boolean {
  return a === "IN_STOCK" || a === "LOW_STOCK";
}

export const ORDER_STATUS = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "CANCELED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const OFFER_TRIGGER = [
  "ALWAYS",
  "CONTAINS_PRODUCT",
  "CONTAINS_CATEGORY",
  "MINIMUM_SUBTOTAL",
] as const;
export type OfferTrigger = (typeof OFFER_TRIGGER)[number];

/**
 * Shipping zones are deliberately a closed set rather than a rules table.
 * Adding a zone later means adding a member here plus a rate column --
 * the checkout flow itself does not need to change.
 */
export const SHIPPING_ZONE = ["US", "CA", "INTL"] as const;
export type ShippingZone = (typeof SHIPPING_ZONE)[number];

export function zoneForCountry(countryCode: string): ShippingZone {
  const cc = countryCode.trim().toUpperCase();
  if (cc === "US") return "US";
  if (cc === "CA") return "CA";
  return "INTL";
}

/**
 * Canonical size ladder. Big Cartel's exported size names map onto these
 * labels; `sortPosition` in the database is derived from this order so that
 * sizes always render S -> 4XL regardless of insertion order.
 */
export const SIZE_LADDER = [
  "Small",
  "Medium",
  "Large",
  "X Large",
  "XX Large",
  "XXX Large",
  "XXXX Large",
] as const;

export const SIZE_SHORT_LABEL: Record<string, string> = {
  Small: "S",
  Medium: "M",
  Large: "L",
  "X Large": "XL",
  "XX Large": "2XL",
  "XXX Large": "3XL",
  "XXXX Large": "4XL",
};

export function sizeSortPosition(label: string): number {
  const i = (SIZE_LADDER as readonly string[]).indexOf(label);
  // Unknown sizes sort after the known ladder rather than colliding at 0.
  return i === -1 ? SIZE_LADDER.length : i;
}

import type { AuthoritativeProduct } from "./types";

/**
 * The price a customer actually pays for one unit, in cents.
 *
 * A sale price only counts when it is present AND genuinely lower than the
 * regular price -- a "sale" of equal or higher value is ignored rather than
 * charged. (The Big Cartel import contains exactly this case: six products
 * flagged on_sale whose sale price equals their regular price.)
 */
export function effectiveUnitPriceCents(
  product: Pick<AuthoritativeProduct, "priceCents" | "salePriceCents">,
): number {
  const { priceCents, salePriceCents } = product;
  if (salePriceCents !== null && salePriceCents < priceCents) {
    return salePriceCents;
  }
  return priceCents;
}

/** The struck-through "was" price, or null when the item is not on sale. */
export function compareAtPriceCents(
  product: Pick<AuthoritativeProduct, "priceCents" | "salePriceCents">,
): number | null {
  return effectiveUnitPriceCents(product) < product.priceCents
    ? product.priceCents
    : null;
}

export function isOnSale(
  product: Pick<AuthoritativeProduct, "priceCents" | "salePriceCents">,
): boolean {
  return compareAtPriceCents(product) !== null;
}

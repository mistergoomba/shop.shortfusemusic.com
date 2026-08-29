import { isPurchasable } from "@sf/shared";
import type { AuthoritativeOffer, AuthoritativeProduct } from "./types";

export interface OfferCartContext {
  /** Product ids currently in the cart, excluding the offer line itself. */
  productIds: Set<number>;
  /** Category ids represented in the cart. */
  categoryIds: Set<number>;
  /** Merchandise subtotal before the offer is applied. */
  subtotalCents: number;
}

/**
 * Does the cart qualify for this offer?
 *
 * Deliberately a switch over four fixed trigger types, not a rules engine.
 * The backend calls this before honouring any promotional price -- the browser
 * saying "I accepted offer 3" is a request, never a fact.
 */
export function isOfferEligible(
  offer: AuthoritativeOffer,
  ctx: OfferCartContext,
): boolean {
  if (!offer.active) return false;

  switch (offer.triggerType) {
    case "ALWAYS":
      return true;

    case "CONTAINS_PRODUCT":
      return (
        offer.triggerProductId !== null && ctx.productIds.has(offer.triggerProductId)
      );

    case "CONTAINS_CATEGORY":
      return (
        offer.triggerCategoryId !== null &&
        ctx.categoryIds.has(offer.triggerCategoryId)
      );

    case "MINIMUM_SUBTOTAL":
      return (
        offer.minimumSubtotalCents !== null &&
        ctx.subtotalCents >= offer.minimumSubtotalCents
      );
  }
}

/**
 * An offer is only presentable if it qualifies AND the thing being offered can
 * actually be shipped. A sold-out sticker pack is not an upsell, it is a
 * broken promise.
 */
export function isOfferPresentable(
  offer: AuthoritativeOffer,
  offeredProduct: AuthoritativeProduct | undefined,
  ctx: OfferCartContext,
): boolean {
  if (!offeredProduct) return false;
  if (!offeredProduct.active) return false;
  if (!isPurchasable(offeredProduct.availability)) return false;
  // Offers add exactly one unit with no size choice, so a sized product
  // cannot be offered without ambiguity about which size ships.
  if (offeredProduct.sizes.length > 0) return false;
  return isOfferEligible(offer, ctx);
}

/** The eligible offers to show in the "WHILE YOU'RE HERE..." strip. */
export function eligibleOffers(
  offers: AuthoritativeOffer[],
  productsById: Map<number, AuthoritativeProduct>,
  ctx: OfferCartContext,
): AuthoritativeOffer[] {
  return offers
    .filter((o) => isOfferPresentable(o, productsById.get(o.productId), ctx))
    .sort((a, b) => a.sortPosition - b.sortPosition || a.id - b.id);
}

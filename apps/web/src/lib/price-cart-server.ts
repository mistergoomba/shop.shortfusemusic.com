import "server-only";
import { eligibleOffers, priceCart, type PricedCart } from "@sf/core";
import type { CartInput } from "@sf/shared";
import {
  getShippingSettings,
  loadActiveOffers,
  loadAuthoritativeProducts,
} from "./catalog";

export interface PricedCartResponse extends PricedCart {
  /** Offers the cart currently qualifies for, for the upsell strip. */
  availableOffers: {
    id: number;
    name: string;
    productId: number;
    productName: string;
    offerPriceCents: number;
    normalPriceCents: number;
    imageUrl: string | null;
  }[];
}

/**
 * The one server-side entry point for pricing a cart. Every caller -- the cart
 * page, the checkout review step, and the Stripe session creation -- goes
 * through here, so there is exactly one code path that decides what an order
 * costs and it always reads the database first.
 */
export async function priceCartFromDatabase(
  input: CartInput,
): Promise<PricedCartResponse> {
  const offers = await loadActiveOffers();

  // Load the requested products AND every product an offer could add, so the
  // offer's own price and stock can be verified in the same pass.
  const productIds = new Set<number>(input.lines.map((l) => l.productId));
  for (const o of offers) {
    productIds.add(o.productId);
    if (o.triggerProductId !== null) productIds.add(o.triggerProductId);
  }

  const [productsById, settings] = await Promise.all([
    loadAuthoritativeProducts([...productIds]),
    getShippingSettings(),
  ]);

  const offersById = new Map(offers.map((o) => [o.id, o]));

  const cart = priceCart({
    lines: input.lines,
    acceptedOfferId: input.acceptedOfferId,
    countryCode: input.countryCode,
    productsById,
    offersById,
    settings,
  });

  // Offer eligibility is judged against the cart WITHOUT the offer line, so
  // accepting an offer can never be what makes that same offer qualify.
  const nonOfferLines = cart.lines.filter((l) => !l.isOffer);
  const ctx = {
    productIds: new Set(nonOfferLines.map((l) => l.productId)),
    categoryIds: new Set(
      nonOfferLines
        .map((l) => productsById.get(l.productId)?.categoryId)
        .filter((id): id is number => id != null),
    ),
    subtotalCents: nonOfferLines.reduce((s, l) => s + l.lineTotalCents, 0),
  };

  const availableOffers = eligibleOffers(offers, productsById, ctx).map((o) => {
    const p = productsById.get(o.productId)!;
    return {
      id: o.id,
      name: o.name,
      productId: o.productId,
      productName: p.name,
      offerPriceCents: o.offerPriceCents,
      normalPriceCents: p.priceCents,
      imageUrl: p.primaryImageUrl,
    };
  });

  return { ...cart, availableOffers };
}

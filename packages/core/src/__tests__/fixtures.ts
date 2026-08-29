import type {
  AuthoritativeOffer,
  AuthoritativeProduct,
  ShippingSettings,
} from "../types";

export function product(
  over: Partial<AuthoritativeProduct> & { id: number },
): AuthoritativeProduct {
  return {
    name: `Product ${over.id}`,
    slug: `product-${over.id}`,
    priceCents: 2000,
    salePriceCents: null,
    categoryId: 1,
    availability: "IN_STOCK",
    active: true,
    sizes: [],
    primaryImageUrl: null,
    ...over,
  };
}

export function offer(
  over: Partial<AuthoritativeOffer> & { id: number; productId: number },
): AuthoritativeOffer {
  return {
    name: `Offer ${over.id}`,
    offerPriceCents: 100,
    active: true,
    triggerType: "ALWAYS",
    triggerProductId: null,
    triggerCategoryId: null,
    minimumSubtotalCents: null,
    sortPosition: 0,
    ...over,
  };
}

export const settings: ShippingSettings = {
  shippingUsCents: 500,
  shippingCaCents: 1500,
  shippingIntlCents: 2500,
  internationalShippingEnabled: true,
  freeShippingThresholdCents: null,
};

export function mapById<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((i) => [i.id, i]));
}

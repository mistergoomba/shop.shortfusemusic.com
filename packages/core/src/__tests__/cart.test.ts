import { describe, expect, it } from "vitest";
import { blockingIssues, priceCart } from "../cart";
import { mapById, offer, product, settings } from "./fixtures";

const shirt = product({
  id: 1,
  name: "Atomic Mutation T-Shirt",
  priceCents: 2000,
  sizes: [
    { id: 11, label: "Small", availability: "IN_STOCK" },
    { id: 12, label: "Medium", availability: "SOLD_OUT" },
    { id: 13, label: "Large", availability: "LOW_STOCK" },
  ],
});

const cd = product({ id: 2, name: "Grim Chronicles CD", priceCents: 1500 });
const soldOutCd = product({ id: 3, priceCents: 1000, availability: "SOLD_OUT" });
const sticker = product({ id: 4, name: "Sticker Pack", priceCents: 500, categoryId: 9 });

const base = {
  acceptedOfferId: null,
  countryCode: null,
  productsById: mapById([shirt, cd, soldOutCd, sticker]),
  offersById: new Map(),
  settings,
};

describe("priceCart — line validation", () => {
  it("prices a simple cart from database values", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 3 }],
    });
    expect(cart.subtotalCents).toBe(4500);
    expect(cart.totalCents).toBe(4500);
    expect(cart.issues).toHaveLength(0);
  });

  it("rejects a sold-out product", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 3, sizeId: null, quantity: 1 }],
    });
    expect(cart.lines).toHaveLength(0);
    expect(cart.issues.map((i) => i.code)).toContain("PRODUCT_SOLD_OUT");
  });

  it("rejects a sold-out size while allowing the in-stock ones", () => {
    const cart = priceCart({
      ...base,
      lines: [
        { productId: 1, sizeId: 11, quantity: 1 },
        { productId: 1, sizeId: 12, quantity: 1 },
      ],
    });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.sizeLabel).toBe("Small");
    expect(cart.issues.map((i) => i.code)).toContain("SIZE_SOLD_OUT");
  });

  it("treats LOW_STOCK as purchasable", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 1, sizeId: 13, quantity: 2 }],
    });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.availability).toBe("LOW_STOCK");
    expect(cart.subtotalCents).toBe(4000);
  });

  it("requires a size for a sized product", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 1, sizeId: null, quantity: 1 }],
    });
    expect(cart.lines).toHaveLength(0);
    expect(cart.issues.map((i) => i.code)).toContain("SIZE_REQUIRED");
  });

  it("refuses a size on a product that has none", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: 99, quantity: 1 }],
    });
    expect(cart.issues.map((i) => i.code)).toContain("SIZE_NOT_APPLICABLE");
  });

  it("refuses a size belonging to a different product", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 1, sizeId: 999, quantity: 1 }],
    });
    expect(cart.issues.map((i) => i.code)).toContain("SIZE_NOT_FOUND");
  });

  it("rejects an inactive product", () => {
    const hidden = product({ id: 7, active: false });
    const cart = priceCart({
      ...base,
      productsById: mapById([hidden]),
      lines: [{ productId: 7, sizeId: null, quantity: 1 }],
    });
    expect(cart.issues.map((i) => i.code)).toContain("PRODUCT_INACTIVE");
  });

  /** The browser can ask for anything; only the database decides the price. */
  it("ignores prices the browser might have tampered with", () => {
    const cart = priceCart({
      ...base,
      lines: [
        { productId: 2, sizeId: null, quantity: 1, unitPriceCents: 1 } as never,
      ],
    });
    expect(cart.subtotalCents).toBe(1500);
  });
});

describe("priceCart — cart offers", () => {
  const stickerOffer = offer({ id: 50, productId: 4, offerPriceCents: 100 });

  it("adds the offered product and records the saving as a discount", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 50,
      offersById: mapById([stickerOffer]),
    });

    // Subtotal carries the sticker at its normal $5; the $4 saving is the
    // discount. Sub - discount = $15 CD + $1 sticker = $16.
    expect(cart.subtotalCents).toBe(2000);
    expect(cart.discountCents).toBe(400);
    expect(cart.totalCents).toBe(1600);
    expect(cart.appliedOfferId).toBe(50);
    expect(cart.lines.find((l) => l.isOffer)?.productId).toBe(4);
  });

  it("refuses an offer whose trigger product is not in the cart", () => {
    const triggered = offer({
      id: 51,
      productId: 4,
      triggerType: "CONTAINS_PRODUCT",
      triggerProductId: 1,
    });
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 51,
      offersById: mapById([triggered]),
    });
    expect(cart.discountCents).toBe(0);
    expect(cart.appliedOfferId).toBeNull();
    expect(cart.issues.map((i) => i.code)).toContain("OFFER_NOT_ELIGIBLE");
  });

  it("honours an offer once its trigger product is present", () => {
    const triggered = offer({
      id: 51,
      productId: 4,
      triggerType: "CONTAINS_PRODUCT",
      triggerProductId: 1,
    });
    const cart = priceCart({
      ...base,
      lines: [{ productId: 1, sizeId: 11, quantity: 1 }],
      acceptedOfferId: 51,
      offersById: mapById([triggered]),
    });
    expect(cart.appliedOfferId).toBe(51);
  });

  it("refuses a minimum-subtotal offer one cent short", () => {
    const min = offer({
      id: 52,
      productId: 4,
      triggerType: "MINIMUM_SUBTOTAL",
      minimumSubtotalCents: 1501,
    });
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 52,
      offersById: mapById([min]),
    });
    expect(cart.issues.map((i) => i.code)).toContain("OFFER_NOT_ELIGIBLE");
  });

  it("applies a minimum-subtotal offer exactly at the threshold", () => {
    const min = offer({
      id: 52,
      productId: 4,
      triggerType: "MINIMUM_SUBTOTAL",
      minimumSubtotalCents: 1500,
    });
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 52,
      offersById: mapById([min]),
    });
    expect(cart.appliedOfferId).toBe(52);
  });

  it("refuses an inactive offer", () => {
    const dead = offer({ id: 53, productId: 4, active: false });
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 53,
      offersById: mapById([dead]),
    });
    expect(cart.discountCents).toBe(0);
    expect(cart.issues.map((i) => i.code)).toContain("OFFER_INACTIVE");
  });

  it("refuses an offer whose product has sold out", () => {
    const goneSticker = product({ id: 4, priceCents: 500, availability: "SOLD_OUT" });
    const cart = priceCart({
      ...base,
      productsById: mapById([cd, goneSticker]),
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 50,
      offersById: mapById([stickerOffer]),
    });
    expect(cart.discountCents).toBe(0);
    expect(cart.issues.map((i) => i.code)).toContain("OFFER_PRODUCT_UNAVAILABLE");
  });

  /** A misconfigured offer must never produce a negative discount. */
  it("clamps an offer priced above the product's normal price", () => {
    const badOffer = offer({ id: 54, productId: 4, offerPriceCents: 9999 });
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 54,
      offersById: mapById([badOffer]),
    });
    expect(cart.discountCents).toBe(0);
    expect(cart.totalCents).toBe(2000);
  });

  it("ignores an offer id that does not exist", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 999,
      offersById: new Map(),
    });
    expect(cart.discountCents).toBe(0);
    expect(cart.issues.map((i) => i.code)).toContain("OFFER_NOT_FOUND");
  });
});

describe("priceCart — totals and shipping", () => {
  it("adds flat shipping once a destination is known", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      countryCode: "CA",
    });
    expect(cart.shippingZone).toBe("CA");
    expect(cart.shippingCents).toBe(1500);
    expect(cart.totalCents).toBe(3000);
  });

  it("charges no shipping before a destination is chosen", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
    });
    expect(cart.shippingCents).toBe(0);
    expect(cart.shippingZone).toBeNull();
  });

  /**
   * A cart offer lowers what the customer pays, so it must also lower what
   * counts toward free shipping -- otherwise the discount silently buys
   * free postage.
   */
  it("measures the free-shipping threshold after the offer discount", () => {
    const withThreshold = { ...settings, freeShippingThresholdCents: 2000 };
    const stickerOffer = offer({ id: 50, productId: 4, offerPriceCents: 100 });
    const cart = priceCart({
      ...base,
      settings: withThreshold,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 50,
      offersById: mapById([stickerOffer]),
      countryCode: "US",
    });

    // Subtotal 2000, discount 400 -> 1600 counts, which is under 2000.
    expect(cart.subtotalCents).toBe(2000);
    expect(cart.freeShippingApplied).toBe(false);
    expect(cart.shippingCents).toBe(500);
    expect(cart.amountToFreeShippingCents).toBe(400);
  });

  it("blocks international destinations when disabled", () => {
    const cart = priceCart({
      ...base,
      settings: { ...settings, internationalShippingEnabled: false },
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      countryCode: "AU",
    });
    expect(cart.issues.map((i) => i.code)).toContain("INTERNATIONAL_DISABLED");
    expect(blockingIssues(cart).length).toBeGreaterThan(0);
  });

  it("reports an empty cart", () => {
    const cart = priceCart({ ...base, lines: [] });
    expect(cart.issues.map((i) => i.code)).toContain("EMPTY_CART");
    expect(cart.totalCents).toBe(0);
  });

  it("keeps tax at zero for v1 but carries the field", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      countryCode: "US",
    });
    expect(cart.taxCents).toBe(0);
    expect(cart.totalCents).toBe(
      cart.subtotalCents - cart.discountCents + cart.shippingCents + cart.taxCents,
    );
  });
});

describe("blockingIssues", () => {
  /**
   * An offer that stopped qualifying should drop off the order, not stop the
   * customer checking out. A sold-out item must stop them.
   */
  it("does not block checkout for offer problems alone", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 2, sizeId: null, quantity: 1 }],
      acceptedOfferId: 999,
      offersById: new Map(),
    });
    expect(cart.issues.length).toBeGreaterThan(0);
    expect(blockingIssues(cart)).toHaveLength(0);
  });

  it("blocks checkout when an item is sold out", () => {
    const cart = priceCart({
      ...base,
      lines: [{ productId: 3, sizeId: null, quantity: 1 }],
    });
    expect(blockingIssues(cart).map((i) => i.code)).toContain("PRODUCT_SOLD_OUT");
  });
});

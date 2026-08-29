import { describe, expect, it } from "vitest";
import { compareAtPriceCents, effectiveUnitPriceCents, isOnSale } from "../pricing";

describe("effectiveUnitPriceCents", () => {
  it("uses the regular price when there is no sale price", () => {
    expect(effectiveUnitPriceCents({ priceCents: 2000, salePriceCents: null })).toBe(
      2000,
    );
  });

  it("uses the sale price when it is genuinely lower", () => {
    expect(effectiveUnitPriceCents({ priceCents: 2000, salePriceCents: 1500 })).toBe(
      1500,
    );
  });

  /**
   * This is the exact shape of the Big Cartel import: six products flagged
   * on_sale whose sale price equals the regular price. Charging the "sale"
   * price would be harmless here, but a sale price ABOVE the regular price
   * would silently overcharge, so both are ignored by the same rule.
   */
  it("ignores a sale price equal to the regular price", () => {
    expect(effectiveUnitPriceCents({ priceCents: 1000, salePriceCents: 1000 })).toBe(
      1000,
    );
    expect(isOnSale({ priceCents: 1000, salePriceCents: 1000 })).toBe(false);
    expect(compareAtPriceCents({ priceCents: 1000, salePriceCents: 1000 })).toBeNull();
  });

  it("never charges a sale price higher than the regular price", () => {
    expect(effectiveUnitPriceCents({ priceCents: 1000, salePriceCents: 9999 })).toBe(
      1000,
    );
    expect(isOnSale({ priceCents: 1000, salePriceCents: 9999 })).toBe(false);
  });

  it("exposes the strike-through price only for a real sale", () => {
    expect(compareAtPriceCents({ priceCents: 2000, salePriceCents: 1500 })).toBe(2000);
    expect(compareAtPriceCents({ priceCents: 2000, salePriceCents: null })).toBeNull();
  });

  it("handles a free item without treating zero as absent", () => {
    expect(effectiveUnitPriceCents({ priceCents: 2000, salePriceCents: 0 })).toBe(0);
    expect(isOnSale({ priceCents: 2000, salePriceCents: 0 })).toBe(true);
  });
});

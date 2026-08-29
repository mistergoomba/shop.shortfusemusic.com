import { describe, expect, it } from "vitest";
import { buildRelatedProducts, type RelatedCandidate } from "../related";

function candidate(
  id: number,
  over: Partial<RelatedCandidate> = {},
): RelatedCandidate {
  return {
    id,
    categoryId: 1,
    active: true,
    availability: "IN_STOCK",
    sizes: [],
    ...over,
  };
}

const subject = candidate(100);

describe("buildRelatedProducts", () => {
  it("puts curated picks first, in the admin's order", () => {
    const curated = [candidate(3), candidate(1), candidate(2)];
    const result = buildRelatedProducts(subject, curated, [], 4);
    expect(result.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it("backfills from the same category once curated picks run out", () => {
    const curated = [candidate(3)];
    const pool = [candidate(4), candidate(5), candidate(6)];
    const result = buildRelatedProducts(subject, curated, pool, 4);
    expect(result.map((r) => r.id)).toEqual([3, 4, 5, 6]);
  });

  it("never exceeds the limit", () => {
    const pool = [candidate(1), candidate(2), candidate(3), candidate(4), candidate(5)];
    expect(buildRelatedProducts(subject, [], pool, 4)).toHaveLength(4);
  });

  it("never suggests the product itself", () => {
    const pool = [candidate(100), candidate(2)];
    const result = buildRelatedProducts(subject, [], pool, 4);
    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it("does not repeat a curated pick in the backfill", () => {
    const curated = [candidate(4)];
    const pool = [candidate(4), candidate(5)];
    const result = buildRelatedProducts(subject, curated, pool, 4);
    expect(result.map((r) => r.id)).toEqual([4, 5]);
  });

  it("skips backfill candidates from a different category", () => {
    const pool = [candidate(4, { categoryId: 99 }), candidate(5)];
    const result = buildRelatedProducts(subject, [], pool, 4);
    expect(result.map((r) => r.id)).toEqual([5]);
  });

  it("does not backfill at all for an uncategorised product", () => {
    const orphan = candidate(100, { categoryId: null });
    const pool = [candidate(4), candidate(5)];
    expect(buildRelatedProducts(orphan, [], pool, 4)).toHaveLength(0);
  });

  describe("only suggests things a customer can actually buy", () => {
    it("skips sold-out and hidden products", () => {
      const pool = [
        candidate(4, { availability: "SOLD_OUT" }),
        candidate(5, { active: false }),
        candidate(6),
      ];
      const result = buildRelatedProducts(subject, [], pool, 4);
      expect(result.map((r) => r.id)).toEqual([6]);
    });

    /** A curated pick that sold out is dropped rather than shown dead. */
    it("skips a curated pick that has sold out", () => {
      const curated = [candidate(3, { availability: "SOLD_OUT" }), candidate(7)];
      const result = buildRelatedProducts(subject, curated, [], 4);
      expect(result.map((r) => r.id)).toEqual([7]);
    });

    it("keeps a sized product while any one size remains", () => {
      const partial = candidate(8, {
        availability: "SOLD_OUT",
        sizes: [{ availability: "SOLD_OUT" }, { availability: "LOW_STOCK" }],
      });
      expect(buildRelatedProducts(subject, [], [partial], 4)).toHaveLength(1);
    });

    it("drops a sized product once every size is gone", () => {
      const gone = candidate(9, {
        availability: "IN_STOCK",
        sizes: [{ availability: "SOLD_OUT" }, { availability: "SOLD_OUT" }],
      });
      expect(buildRelatedProducts(subject, [], [gone], 4)).toHaveLength(0);
    });
  });
});

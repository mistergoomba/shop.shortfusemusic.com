import { isPurchasable } from "@sf/shared";
import type { AuthoritativeProduct } from "./types";

export interface RelatedCandidate {
  id: number;
  categoryId: number | null;
  active: boolean;
  availability: AuthoritativeProduct["availability"];
  sizes: { availability: AuthoritativeProduct["availability"] }[];
}

function isBuyable(p: RelatedCandidate): boolean {
  if (!p.active) return false;
  if (p.sizes.length > 0) return p.sizes.some((s) => isPurchasable(s.availability));
  return isPurchasable(p.availability);
}

/**
 * Build the "YOU MIGHT ALSO DIG" list.
 *
 * Manually curated picks always come first, in the order the admin set. Any
 * remaining slots are backfilled with other purchasable products from the same
 * category. That is the whole algorithm -- there is no recommendation engine
 * here and there should not be one.
 */
export function buildRelatedProducts<T extends RelatedCandidate>(
  product: RelatedCandidate,
  curated: T[],
  sameCategoryPool: T[],
  limit = 4,
): T[] {
  const chosen: T[] = [];
  const seen = new Set<number>([product.id]);

  for (const candidate of curated) {
    if (chosen.length >= limit) break;
    if (seen.has(candidate.id)) continue;
    // A curated pick that has sold out is skipped rather than shown dead.
    if (!isBuyable(candidate)) continue;
    seen.add(candidate.id);
    chosen.push(candidate);
  }

  if (chosen.length < limit && product.categoryId !== null) {
    for (const candidate of sameCategoryPool) {
      if (chosen.length >= limit) break;
      if (seen.has(candidate.id)) continue;
      if (candidate.categoryId !== product.categoryId) continue;
      if (!isBuyable(candidate)) continue;
      seen.add(candidate.id);
      chosen.push(candidate);
    }
  }

  return chosen;
}

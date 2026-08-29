import type { ProductCardView } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";

export function ProductGrid({
  products,
  priorityCount = 0,
  compact = false,
}: {
  products: ProductCardView[];
  /** Eagerly load the first N images; everything below the fold stays lazy. */
  priorityCount?: number;
  /**
   * For grids inside a narrow column, such as the suggestions that appear
   * beside the buy button after adding to cart. The full-width grid goes four
   * across at xl, which in a third-width column would be ~100px cards.
   */
  compact?: boolean;
}) {
  if (products.length === 0) {
    return (
      <p className="border border-ink-line bg-ink-raised px-4 py-8 text-center text-bone-dim">
        Nothing here yet. Check back soon.
      </p>
    );
  }

  const columns = compact
    ? "grid-cols-2"
    : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <ul className={`grid gap-4 sm:gap-5 ${columns}`}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

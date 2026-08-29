import type { ProductCardView } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: ProductCardView[];
  /** Eagerly load the first N images; everything below the fold stays lazy. */
  priorityCount?: number;
}) {
  if (products.length === 0) {
    return (
      <p className="border border-ink-line bg-ink-raised px-4 py-8 text-center text-bone-dim">
        Nothing here yet. Check back soon.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

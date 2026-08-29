"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SIZE_SHORT_LABEL, isPurchasable } from "@sf/shared";
import { useCart } from "@/lib/cart-store";
import type { ProductDetailView } from "@/lib/catalog";

/**
 * Purchasing panel. This is the part of the page that must stay clean --
 * grime lives in the shell around it, never on the size buttons or the CTA.
 */
export function AddToCart({ product }: { product: ProductDetailView }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const setJustAdded = useCart((s) => s.setJustAdded);

  const hasSizes = product.sizes.length > 0;
  const firstAvailable = product.sizes.find((s) => isPurchasable(s.availability));
  const [sizeId, setSizeId] = useState<number | null>(firstAvailable?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const unitPriceCents =
    product.salePriceCents !== null && product.salePriceCents < product.priceCents
      ? product.salePriceCents
      : product.priceCents;

  const anythingAvailable = hasSizes
    ? product.sizes.some((s) => isPurchasable(s.availability))
    : isPurchasable(product.availability);

  const selectedSize = product.sizes.find((s) => s.id === sizeId) ?? null;
  const selectedLowStock = selectedSize?.availability === "LOW_STOCK";
  const productLowStock = !hasSizes && product.availability === "LOW_STOCK";

  function onAdd() {
    if (hasSizes && sizeId === null) {
      setError("Pick a size first.");
      return;
    }
    setError(null);
    add({
      productId: product.id,
      sizeId,
      quantity: 1,
      name: product.name,
      slug: product.slug,
      sizeLabel: selectedSize?.label ?? null,
      unitPriceCents,
      imageUrl: product.images[0]?.url ?? null,
    });
    setAdded(true);
    // Drives the confirmation panel below, which persists after this button
    // reverts to its normal label.
    setJustAdded(product.id);
    router.refresh();
    window.setTimeout(() => setAdded(false), 2500);
  }

  if (!anythingAvailable) {
    return (
      <div className="border border-ink-line bg-ink-raised px-4 py-4 text-center">
        <p className="stamp text-lg text-bone-dim">Sold Out</p>
        <p className="mt-1 text-sm text-bone-faint">
          This one&rsquo;s gone. Check back — restocks happen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {hasSizes && (
        <fieldset>
          <legend className="stamp mb-2.5 text-sm text-bone-dim">Size</legend>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => {
              const available = isPurchasable(s.availability);
              const selected = s.id === sizeId;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!available}
                  aria-pressed={selected}
                  onClick={() => {
                    setSizeId(s.id);
                    setError(null);
                  }}
                  className={`min-h-11 min-w-13 border px-3.5 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border-blood bg-blood text-bone"
                      : available
                        ? "border-ink-line bg-ink-card text-bone hover:border-blood"
                        : "cursor-not-allowed border-ink-line/50 bg-ink text-bone-faint line-through"
                  }`}
                >
                  {SIZE_SHORT_LABEL[s.label] ?? s.label}
                  {!available && <span className="sr-only"> — sold out</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {(selectedLowStock || productLowStock) && (
        <p className="stamp text-sm text-blood-bright" role="status">
          Low stock — only a few left
        </p>
      )}

      {error && (
        <p className="text-sm text-blood-bright" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="stamp min-h-13 w-full bg-blood px-6 py-3.5 text-lg text-bone transition-colors hover:bg-blood-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone"
      >
        {added ? "Added ✓" : "Add to Cart"}
      </button>

      <p className="sr-only" role="status" aria-live="polite">
        {added ? `${product.name} added to your cart.` : ""}
      </p>
    </div>
  );
}

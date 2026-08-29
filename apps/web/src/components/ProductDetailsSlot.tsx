"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-store";

/**
 * The area under the buy button on a product page.
 *
 * Normally it shows the product description. Once the item has been added to
 * the cart it swaps to a confirmation plus the two things someone actually
 * wants next: carry on shopping, or go pay. The suggestions move up here too
 * (see RelatedSlot), because "what else is there" is the live question at
 * exactly this moment and the bottom of the page is too far away.
 *
 * The confirmation persists rather than timing out. The Add to Cart button
 * reverts to its normal label after a moment so it stays usable for a second
 * unit, and if the confirmation vanished with it there would be no lasting
 * signal that anything happened.
 */
export function ProductDetailsSlot({
  productId,
  productName,
  categoryHref,
  description,
  related,
}: {
  productId: number;
  productName: string;
  /** Where "Keep Shopping" goes when there is no history to go back to. */
  categoryHref: string;
  description: React.ReactNode;
  related: React.ReactNode;
}) {
  const router = useRouter();
  const justAddedProductId = useCart((s) => s.justAddedProductId);
  const clearJustAdded = useCart((s) => s.clearJustAdded);
  const added = justAddedProductId === productId;

  // Leaving this product page ends the confirmation, so navigating back to it
  // later starts clean rather than re-showing a stale panel.
  useEffect(() => () => clearJustAdded(), [clearJustAdded]);

  if (!added) {
    return <>{description}</>;
  }

  return (
    <div className="border-t border-ink-line pt-6">
      <div
        role="status"
        className="border border-blood bg-blood-deep/25 px-4 py-3 text-center"
      >
        <p className="stamp text-lg text-blood-bright">Added to cart</p>
        <p className="mt-0.5 text-sm text-bone-dim">{productName}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            // Back preserves the customer's place in whatever grid they came
            // from. A direct arrival has no history to return to, so fall
            // back to the product's own category.
            if (window.history.length > 1) router.back();
            else router.push(categoryHref);
          }}
          className="stamp min-h-12 flex-1 border border-ink-line px-5 py-3 text-bone transition-colors hover:border-blood hover:text-blood-bright"
        >
          Keep Shopping
        </button>

        <Link
          href="/cart"
          className="stamp flex min-h-12 flex-1 items-center justify-center bg-blood px-5 py-3 text-bone transition-colors hover:bg-blood-bright"
        >
          Go to Cart
        </Link>
      </div>

      {related}
    </div>
  );
}

/**
 * The suggestions at the bottom of the page. Hidden once the item is added,
 * because they have been moved up beside the confirmation instead.
 */
export function RelatedSlot({
  productId,
  children,
}: {
  productId: number;
  children: React.ReactNode;
}) {
  const justAddedProductId = useCart((s) => s.justAddedProductId);
  if (justAddedProductId === productId) return null;
  return <>{children}</>;
}

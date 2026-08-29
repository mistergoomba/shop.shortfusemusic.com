"use client";

import Image from "next/image";
import { formatCents } from "@sf/shared";
import type { PricedCartResponse } from "@/lib/price-cart-server";
import { useCart } from "@/lib/cart-store";

/**
 * The "WHILE YOU'RE HERE..." strip.
 *
 * Only offers the server has already confirmed the cart qualifies for are
 * shown, and accepting one only records the offer id -- the price is applied
 * server-side after re-checking eligibility, never from this component.
 */
export function CartOfferStrip({ cart }: { cart: PricedCartResponse }) {
  const acceptedOfferId = useCart((s) => s.acceptedOfferId);
  const acceptOffer = useCart((s) => s.acceptOffer);
  const clearOffer = useCart((s) => s.clearOffer);

  const applied = cart.appliedOfferId;
  const offer =
    cart.availableOffers.find((o) => o.id === applied) ?? cart.availableOffers[0];

  if (!offer) return null;
  const isApplied = applied === offer.id;

  return (
    <section
      aria-label="Cart add-on offer"
      className="grain relative overflow-hidden border-2 border-blood bg-ink-raised"
    >
      <div className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
        {offer.imageUrl ? (
          <Image
            src={offer.imageUrl}
            alt=""
            aria-hidden="true"
            width={80}
            height={80}
            className="h-16 w-16 shrink-0 border border-ink-line object-cover"
          />
        ) : (
          <Image
            src="/brand/skull.png"
            alt=""
            aria-hidden="true"
            width={80}
            height={80}
            className="h-16 w-16 shrink-0 object-contain"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="stamp text-xs text-bone-faint">While you&rsquo;re here…</p>
          <p className="stamp mt-1 text-lg text-bone sm:text-xl">
            {offer.name}{" "}
            <span className="text-blood-bright">
              {formatCents(offer.offerPriceCents)}
            </span>
          </p>
          {offer.normalPriceCents > offer.offerPriceCents && (
            <p className="text-xs text-bone-faint">
              Normally {formatCents(offer.normalPriceCents)} — save{" "}
              {formatCents(offer.normalPriceCents - offer.offerPriceCents)}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => (isApplied ? clearOffer() : acceptOffer(offer.id))}
          aria-pressed={isApplied}
          className={`stamp min-h-11 w-full shrink-0 px-6 py-2.5 text-sm transition-colors sm:w-auto ${
            isApplied
              ? "border border-bone-faint bg-ink text-bone-dim hover:text-bone"
              : "bg-blood text-bone hover:bg-blood-bright"
          }`}
        >
          {isApplied ? "Remove" : "Add to Cart"}
        </button>
      </div>
    </section>
  );
}

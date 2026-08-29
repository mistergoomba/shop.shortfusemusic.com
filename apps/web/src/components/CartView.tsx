"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCents, SIZE_SHORT_LABEL } from "@sf/shared";
import { useCart } from "@/lib/cart-store";
import { usePricedCart } from "@/lib/use-priced-cart";
import { CartOfferStrip } from "./CartOfferStrip";
import { CountrySelect } from "./CountrySelect";

export function CartView() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);

  const [country, setCountry] = useState<string>("US");
  const { cart, loading, failed, hydrated } = usePricedCart(country);

  if (!hydrated || (loading && !cart)) {
    return <p className="py-16 text-center text-bone-dim">Loading your cart…</p>;
  }

  if (failed) {
    return (
      <div className="border border-blood bg-ink-raised px-4 py-8 text-center">
        <p className="text-bone">We couldn&rsquo;t load your cart just now.</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="stamp mt-4 bg-blood px-5 py-2.5 text-bone hover:bg-blood-bright"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-ink-line bg-ink-raised px-4 py-16 text-center">
        <p className="stamp text-xl text-bone">Your cart is empty</p>
        <p className="mt-2 text-bone-dim">Nothing in here but dust.</p>
        <Link
          href="/"
          className="stamp mt-6 inline-block bg-blood px-6 py-3 text-bone transition-colors hover:bg-blood-bright"
        >
          Back to the Shop
        </Link>
      </div>
    );
  }

  if (!cart) return null;

  // Problems the customer must resolve before they can check out.
  const lineIssues = cart.issues.filter(
    (i) => !i.code.startsWith("OFFER") && i.code !== "EMPTY_CART",
  );
  const canCheckout = lineIssues.length === 0 && cart.lines.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <div className="flex flex-col gap-5">
        {lineIssues.length > 0 && (
          <div
            role="alert"
            className="border border-blood bg-blood-deep/25 px-4 py-3 text-sm text-bone"
          >
            <p className="stamp mb-1 text-blood-bright">Heads up</p>
            <ul className="list-disc space-y-1 pl-5">
              {lineIssues.map((i, n) => (
                <li key={`${i.code}-${n}`}>{i.message}</li>
              ))}
            </ul>
          </div>
        )}

        <ul className="flex flex-col divide-y divide-ink-line border-y border-ink-line">
          {items.map((item) => {
            // Match against the server's view so a line the server rejected is
            // visibly flagged rather than quietly priced from stale data.
            const priced = cart.lines.find(
              (l) =>
                !l.isOffer &&
                l.productId === item.productId &&
                l.sizeId === item.sizeId,
            );
            const unavailable = !priced;

            return (
              <li
                key={`${item.productId}:${item.sizeId ?? "-"}`}
                className="flex gap-4 py-4"
              >
                <Link
                  href={`/product/${item.slug}`}
                  className="shrink-0"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={112}
                      height={112}
                      className={`h-20 w-20 border border-ink-line object-cover sm:h-28 sm:w-28 ${
                        unavailable ? "opacity-40 grayscale" : ""
                      }`}
                    />
                  ) : (
                    <div className="h-20 w-20 border border-ink-line bg-ink-card sm:h-28 sm:w-28" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Link
                    href={`/product/${item.slug}`}
                    className="stamp text-sm text-bone hover:text-blood-bright sm:text-base"
                  >
                    {priced?.name ?? item.name}
                  </Link>

                  {item.sizeLabel && (
                    <p className="text-sm text-bone-dim">
                      Size {SIZE_SHORT_LABEL[item.sizeLabel] ?? item.sizeLabel}
                    </p>
                  )}

                  {unavailable ? (
                    <p className="stamp text-sm text-blood-bright">Unavailable</p>
                  ) : (
                    <p className="text-sm text-bone-dim">
                      {formatCents(priced.unitPriceCents)} each
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 text-sm">
                      <span className="sr-only">
                        Quantity for {item.name}
                        {item.sizeLabel ? `, size ${item.sizeLabel}` : ""}
                      </span>
                      <select
                        value={item.quantity}
                        onChange={(e) =>
                          setQuantity(
                            item.productId,
                            item.sizeId,
                            Number(e.target.value),
                          )
                        }
                        className="min-h-11 border border-ink-line bg-ink-card px-2 py-1.5 text-bone"
                      >
                        {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => remove(item.productId, item.sizeId)}
                      className="min-h-11 text-sm text-bone-faint underline underline-offset-4 hover:text-blood-bright"
                    >
                      Remove
                      <span className="sr-only">
                        {" "}
                        {item.name}
                        {item.sizeLabel ? `, size ${item.sizeLabel}` : ""}
                      </span>
                    </button>
                  </div>
                </div>

                {!unavailable && (
                  <p className="stamp shrink-0 self-start text-base text-bone">
                    {formatCents(priced.lineTotalCents)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {cart.availableOffers.length > 0 && <CartOfferStrip cart={cart} />}
      </div>

      {/* ---- Summary ---- */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="border border-ink-line bg-ink-raised p-5">
          <h2 className="rule-blood mb-6 text-xl text-bone">Summary</h2>

          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-bone-dim">Subtotal</dt>
              <dd className="text-bone">{formatCents(cart.subtotalCents)}</dd>
            </div>

            {cart.discountCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-bone-dim">Add-on discount</dt>
                <dd className="text-blood-bright">
                  −{formatCents(cart.discountCents)}
                </dd>
              </div>
            )}

            <div className="flex flex-col gap-1.5 border-t border-ink-line pt-3">
              <CountrySelect value={country} onChange={setCountry} />
            </div>

            <div className="flex justify-between">
              <dt className="text-bone-dim">Shipping</dt>
              <dd className="text-bone">
                {cart.freeShippingApplied ? (
                  <span className="text-blood-bright">Free</span>
                ) : (
                  formatCents(cart.shippingCents)
                )}
              </dd>
            </div>

            {cart.amountToFreeShippingCents !== null &&
              cart.amountToFreeShippingCents > 0 && (
                <p className="text-xs text-bone-faint">
                  Spend {formatCents(cart.amountToFreeShippingCents)} more for free
                  shipping.
                </p>
              )}

            <div className="mt-2 flex justify-between border-t border-ink-line pt-3">
              <dt className="stamp text-lg text-bone">Total</dt>
              <dd className="stamp text-lg text-blood-bright">
                {formatCents(cart.totalCents)}
              </dd>
            </div>
          </dl>

          {canCheckout ? (
            <Link
              href="/checkout"
              className="stamp mt-6 flex min-h-13 w-full items-center justify-center bg-blood px-6 py-3.5 text-lg text-bone transition-colors hover:bg-blood-bright"
            >
              Checkout
            </Link>
          ) : (
            <p className="mt-6 border border-ink-line px-4 py-3 text-center text-sm text-bone-dim">
              Fix the problems above to check out.
            </p>
          )}

          <p className="mt-3 text-center text-xs text-bone-faint">
            Taxes, if any, are calculated at payment.
          </p>
        </div>
      </aside>
    </div>
  );
}

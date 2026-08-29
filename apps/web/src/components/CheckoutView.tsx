"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatCents, SIZE_SHORT_LABEL } from "@sf/shared";
import { useCart } from "@/lib/cart-store";
import { usePricedCart } from "@/lib/use-priced-cart";
import { CountrySelect } from "./CountrySelect";

/**
 * The branded review step before Stripe.
 *
 * Two jobs: collect the destination country so shipping can be quoted and
 * shown BEFORE payment (Stripe Checkout only collects an address after the
 * session exists), and show the customer exactly what they are about to pay.
 * The grime is turned right down here -- this screen has to feel safe.
 */
export function CheckoutView() {
  const items = useCart((s) => s.items);
  const [country, setCountry] = useState("US");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { cart, loading, hydrated } = usePricedCart(country);

  if (!hydrated || (loading && !cart)) {
    return <p className="py-16 text-center text-bone-dim">Loading…</p>;
  }

  if (items.length === 0 || !cart || cart.lines.length === 0) {
    return (
      <div className="border border-ink-line bg-ink-raised px-4 py-16 text-center">
        <p className="stamp text-xl text-bone">Nothing to check out</p>
        <Link
          href="/"
          className="stamp mt-6 inline-block bg-blood px-6 py-3 text-bone hover:bg-blood-bright"
        >
          Back to the Shop
        </Link>
      </div>
    );
  }

  const blocking = cart.issues.filter(
    (i) => !i.code.startsWith("OFFER") && i.code !== "EMPTY_CART",
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: items.map((i) => ({
            productId: i.productId,
            sizeId: i.sizeId,
            quantity: i.quantity,
          })),
          acceptedOfferId: useCart.getState().acceptedOfferId,
          email: trimmed,
          countryCode: country,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "We couldn't start checkout. Please try again.");
        setSubmitting(false);
        return;
      }

      // Hand off to Stripe. The cart is deliberately NOT cleared here -- it is
      // cleared on the success page, so backing out of Stripe keeps the cart.
      window.location.href = data.url;
    } catch {
      setError("We couldn't reach the payment service. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-bone">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailError ? "true" : undefined}
            aria-describedby={emailError ? "email-error" : "email-hint"}
            className="min-h-12 w-full border border-ink-line bg-ink-card px-3 py-2.5 text-bone placeholder:text-bone-faint"
            placeholder="you@example.com"
          />
          {emailError ? (
            <p id="email-error" role="alert" className="mt-1.5 text-sm text-blood-bright">
              {emailError}
            </p>
          ) : (
            <p id="email-hint" className="mt-1.5 text-xs text-bone-faint">
              Your order confirmation goes here.
            </p>
          )}
        </div>

        <div>
          <CountrySelect value={country} onChange={setCountry} id="ship-country" />
          <p className="mt-1.5 text-xs text-bone-faint">
            Your full shipping address is collected securely on the next step.
          </p>
        </div>

        {blocking.length > 0 && (
          <div role="alert" className="border border-blood bg-blood-deep/25 px-4 py-3 text-sm">
            <p className="stamp mb-1 text-blood-bright">Your cart changed</p>
            <ul className="list-disc space-y-1 pl-5 text-bone">
              {blocking.map((i, n) => (
                <li key={`${i.code}-${n}`}>{i.message}</li>
              ))}
            </ul>
            <Link href="/cart" className="mt-2 inline-block text-blood-bright underline">
              Back to cart
            </Link>
          </div>
        )}

        {error && (
          <p role="alert" className="border border-blood px-4 py-3 text-sm text-bone">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || blocking.length > 0}
          className="stamp min-h-13 w-full bg-blood px-6 py-3.5 text-lg text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:bg-ink-card disabled:text-bone-faint"
        >
          {submitting ? "Taking you to payment…" : "Continue to Payment"}
        </button>

        <p className="text-center text-xs text-bone-faint">
          Payment is processed securely by Stripe. We never see or store your card
          details.
        </p>
      </form>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="border border-ink-line bg-ink-raised p-5">
          <h2 className="rule-blood mb-6 text-xl text-bone">Your Order</h2>

          <ul className="mb-5 flex flex-col gap-3 border-b border-ink-line pb-5">
            {cart.lines.map((line, n) => (
              <li key={`${line.productId}-${line.sizeId ?? "-"}-${n}`} className="flex gap-3">
                {line.imageUrl && (
                  <Image
                    src={line.imageUrl}
                    alt=""
                    aria-hidden="true"
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 border border-ink-line object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-bone">
                    {line.name}
                    {line.isOffer && (
                      <span className="ml-1.5 text-xs text-blood-bright">add-on</span>
                    )}
                  </p>
                  <p className="text-bone-faint">
                    {line.sizeLabel &&
                      `Size ${SIZE_SHORT_LABEL[line.sizeLabel] ?? line.sizeLabel} · `}
                    Qty {line.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-bone">
                  {formatCents(line.lineTotalCents)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-bone-dim">Subtotal</dt>
              <dd className="text-bone">{formatCents(cart.subtotalCents)}</dd>
            </div>
            {cart.discountCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-bone-dim">Add-on discount</dt>
                <dd className="text-blood-bright">−{formatCents(cart.discountCents)}</dd>
              </div>
            )}
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
            <div className="mt-2 flex justify-between border-t border-ink-line pt-3">
              <dt className="stamp text-lg text-bone">Total</dt>
              <dd className="stamp text-lg text-blood-bright">
                {formatCents(cart.totalCents)}
              </dd>
            </div>
          </dl>

          <Link
            href="/cart"
            className="mt-5 block text-center text-sm text-bone-faint underline underline-offset-4 hover:text-bone"
          >
            Edit cart
          </Link>
        </div>
      </aside>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents, SIZE_SHORT_LABEL } from "@sf/shared";
import { getOrderByPublicRef } from "@/lib/orders";
import { countryName } from "@/lib/countries";
import { ClearCartOnMount } from "@/components/ClearCartOnMount";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

/**
 * Order confirmation.
 *
 * Reached via an unguessable public reference, never a sequential id. It shows
 * the order's real status from the database -- if the Stripe webhook has not
 * landed yet the page says "confirming", rather than claiming a payment
 * succeeded because the browser happened to arrive here.
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const order = await getOrderByPublicRef(ref);
  if (!order) notFound();

  const paid = order.status !== "PENDING" && order.status !== "CANCELED";

  return (
    <div className="mx-auto max-w-[820px] px-4 py-10 lg:px-8 lg:py-14">
      {/* Only clear the cart for an order that actually went through. */}
      {paid && <ClearCartOnMount />}

      <div className="mb-10 flex flex-col items-center gap-4 text-center">
        <Link href="/" aria-label="Short Fuse, back to the shop">
          <Image
            src="/brand/logo.png"
            alt="Short Fuse"
            width={900}
            height={649}
            className="h-14 w-auto sm:h-18"
          />
        </Link>

        {order.status === "CANCELED" ? (
          <>
            <h1 className="text-2xl text-bone sm:text-3xl">Order canceled</h1>
            <p className="text-bone-dim">
              This order was not completed and you have not been charged.
            </p>
          </>
        ) : paid ? (
          <>
            <h1 className="text-2xl text-blood-bright sm:text-3xl">
              Order confirmed — thanks
            </h1>
            <p className="text-bone-dim">
              A receipt is on its way to{" "}
              <span className="text-bone">{order.email}</span>.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl text-bone sm:text-3xl">Confirming your payment</h1>
            <p className="max-w-prose text-bone-dim">
              We&rsquo;re waiting on final confirmation from our payment processor.
              This usually takes a few seconds — refresh in a moment. Nothing is
              wrong with your order.
            </p>
          </>
        )}

        <p className="stamp mt-2 border border-ink-line px-4 py-2 text-lg text-bone">
          Order {order.orderNumber}
        </p>
      </div>

      <section
        aria-label="Order summary"
        className="border border-ink-line bg-ink-raised"
      >
        <ul className="divide-y divide-ink-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-4">
              {item.imageUrl && (
                <Image
                  src={item.imageUrl}
                  alt=""
                  aria-hidden="true"
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 border border-ink-line object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-bone">
                  {item.productName}
                  {item.isOffer && (
                    <span className="ml-2 text-xs text-blood-bright">add-on</span>
                  )}
                </p>
                <p className="text-sm text-bone-faint">
                  {item.sizeLabel &&
                    `Size ${SIZE_SHORT_LABEL[item.sizeLabel] ?? item.sizeLabel} · `}
                  Qty {item.quantity} · {formatCents(item.unitPriceCents)} each
                </p>
              </div>
              <p className="shrink-0 text-bone">{formatCents(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-2.5 border-t border-ink-line p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-bone-dim">Subtotal</dt>
            <dd className="text-bone">{formatCents(order.subtotalCents)}</dd>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-bone-dim">Add-on discount</dt>
              <dd className="text-blood-bright">
                −{formatCents(order.discountCents)}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-bone-dim">Shipping</dt>
            <dd className="text-bone">{formatCents(order.shippingCents)}</dd>
          </div>
          {order.taxCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-bone-dim">Tax</dt>
              <dd className="text-bone">{formatCents(order.taxCents)}</dd>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-ink-line pt-3">
            <dt className="stamp text-lg text-bone">Total</dt>
            <dd className="stamp text-lg text-blood-bright">
              {formatCents(order.totalCents)}
            </dd>
          </div>
        </dl>
      </section>

      {order.shipLine1 && (
        <section className="mt-6 border border-ink-line bg-ink-raised p-4">
          <h2 className="stamp mb-2 text-sm text-bone-dim">Shipping to</h2>
          <address className="not-italic text-sm leading-relaxed text-bone">
            {order.shipName && (
              <>
                {order.shipName}
                <br />
              </>
            )}
            {order.shipLine1}
            <br />
            {order.shipLine2 && (
              <>
                {order.shipLine2}
                <br />
              </>
            )}
            {[order.shipCity, order.shipState, order.shipPostalCode]
              .filter(Boolean)
              .join(", ")}
            <br />
            {order.shipCountry && countryName(order.shipCountry)}
          </address>
        </section>
      )}

      <div className="mt-8 flex flex-col items-center gap-4 text-center">
        {order.trackingNumber ? (
          <p className="text-sm text-bone">
            Tracking number:{" "}
            <span className="stamp text-blood-bright">{order.trackingNumber}</span>
          </p>
        ) : (
          paid && (
            <p className="max-w-prose text-sm text-bone-dim">
              We pack and ship by hand, usually within a few days. You&rsquo;ll get
              an email with tracking as soon as it goes out.
            </p>
          )
        )}

        <p className="text-xs text-bone-faint">
          Keep this page — it&rsquo;s your order status link.
        </p>

        <Link
          href="/"
          className="stamp mt-2 bg-blood px-6 py-3 text-bone transition-colors hover:bg-blood-bright"
        >
          Back to the Shop
        </Link>
      </div>
    </div>
  );
}

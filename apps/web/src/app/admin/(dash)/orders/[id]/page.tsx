import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@sf/shared";
import { getOrder } from "@/lib/admin-data";
import { countryName } from "@/lib/countries";
import { env } from "@/lib/env";
import { Card, PageHeading, StatusPill } from "@/components/admin/ui";
import { OrderActions } from "@/components/admin/OrderActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await getOrder(orderId);
  if (!order) notFound();

  return (
    <>
      <PageHeading action={<StatusPill value={order.status} />}>
        {order.orderNumber}
      </PageHeading>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card title="Items">
            <ul className="divide-y divide-ink-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 border border-ink-line object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 border border-ink-line bg-ink-card" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-bone">
                      {item.productName}
                      {item.isOffer && (
                        <span className="ml-2 text-xs text-blood-bright">add-on</span>
                      )}
                    </p>
                    <p className="text-xs text-bone-faint">
                      {item.sizeLabel && `Size ${item.sizeLabel} · `}
                      Qty {item.quantity} · {formatCents(item.unitPriceCents)} each
                      {item.productId === null && " · product since deleted"}
                    </p>
                  </div>
                  <p className="shrink-0 text-bone">
                    {formatCents(item.lineTotalCents)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 flex flex-col gap-2 border-t border-ink-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-bone-dim">Subtotal</dt>
                <dd className="text-bone">{formatCents(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-bone-dim">Discount</dt>
                  <dd className="text-blood-bright">
                    −{formatCents(order.discountCents)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-bone-dim">
                  Shipping{" "}
                  <span className="text-bone-faint">({order.shippingZone})</span>
                </dt>
                <dd className="text-bone">{formatCents(order.shippingCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-bone-dim">Tax</dt>
                <dd className="text-bone">{formatCents(order.taxCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-line pt-2">
                <dt className="stamp text-base text-bone">Total</dt>
                <dd className="stamp text-base text-blood-bright">
                  {formatCents(order.totalCents)}
                </dd>
              </div>
            </dl>
          </Card>

          <OrderActions
            order={{
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              trackingNumber: order.trackingNumber,
              internalNotes: order.internalNotes,
              totalCents: order.totalCents,
              hasPaymentIntent: Boolean(order.stripePaymentIntentId),
            }}
          />
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Customer">
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-bone-faint">Email</dt>
                <dd className="break-all text-bone">{order.email}</dd>
              </div>
              {order.customerName && (
                <div>
                  <dt className="text-bone-faint">Name</dt>
                  <dd className="text-bone">{order.customerName}</dd>
                </div>
              )}
              <div>
                <dt className="text-bone-faint">Placed</dt>
                <dd className="text-bone">{order.createdAt.toLocaleString()}</dd>
              </div>
              {order.paidAt && (
                <div>
                  <dt className="text-bone-faint">Paid</dt>
                  <dd className="text-bone">{order.paidAt.toLocaleString()}</dd>
                </div>
              )}
              {order.shippedAt && (
                <div>
                  <dt className="text-bone-faint">Shipped</dt>
                  <dd className="text-bone">{order.shippedAt.toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Shipping address">
            {order.shipLine1 ? (
              <address className="text-sm not-italic leading-relaxed text-bone">
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
            ) : (
              <p className="text-sm text-bone-faint">
                No address yet — Stripe collects it during payment, so it appears
                once the order is paid.
              </p>
            )}
          </Card>

          <Card title="Stripe">
            <dl className="flex flex-col gap-2 text-xs">
              <div>
                <dt className="text-bone-faint">Checkout session</dt>
                <dd className="break-all text-bone-dim">
                  {order.stripeCheckoutSessionId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-bone-faint">Payment intent</dt>
                <dd className="break-all text-bone-dim">
                  {order.stripePaymentIntentId ?? "—"}
                </dd>
              </div>
              {order.stripeRefundId && (
                <div>
                  <dt className="text-bone-faint">Refund</dt>
                  <dd className="break-all text-bone-dim">{order.stripeRefundId}</dd>
                </div>
              )}
            </dl>
            {order.stripePaymentIntentId && (
              <a
                href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-blood-bright underline underline-offset-4"
              >
                Open in Stripe ↗
              </a>
            )}
          </Card>

          <Link
            href={`${env.siteUrl}/order/${order.publicRef}`}
            target="_blank"
            rel="noopener"
            className="text-center text-sm text-bone-faint underline underline-offset-4 hover:text-bone"
          >
            Customer&rsquo;s order page ↗
          </Link>
        </div>
      </div>
    </>
  );
}

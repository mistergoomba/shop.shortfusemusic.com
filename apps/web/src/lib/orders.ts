import "server-only";
import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import {
  getDb,
  orders,
  orderItems,
  orderNumberSeq,
  eq,
  sql,
  asc,
} from "@sf/db";
import type { PricedCart } from "@sf/core";
import { sendOrderConfirmation } from "./email/send";

/**
 * Human-friendly order number, e.g. "SF-1042".
 *
 * Backed by a counter row rather than the products' serial id, so the number
 * shown to a customer does not leak how many orders the shop has taken, and
 * so it stays stable if rows are ever moved between environments.
 */
async function nextOrderNumber(): Promise<string> {
  const db = getDb();
  const [row] = await db
    .update(orderNumberSeq)
    .set({ next: sql`${orderNumberSeq.next} + 1` })
    .where(eq(orderNumberSeq.id, 1))
    .returning({ next: orderNumberSeq.next });

  if (!row) throw new Error("order_number_seq row is missing. Run: pnpm db:seed");
  return `SF-${row.next - 1}`;
}

/** Unguessable token for the public order-status URL. */
function publicRef(): string {
  return randomBytes(16).toString("hex");
}

export interface CreateOrderArgs {
  cart: PricedCart;
  email: string;
  countryCode: string;
}

export interface CreatedOrder {
  id: number;
  orderNumber: string;
  publicRef: string;
}

/**
 * Writes a PENDING order and its line-item snapshots.
 *
 * The snapshot is the point: names and prices are copied in, never referenced,
 * so a later price change or a deleted product cannot rewrite what a customer
 * was charged. The order only becomes PAID from the Stripe webhook.
 */
export async function createPendingOrder({
  cart,
  email,
  countryCode,
}: CreateOrderArgs): Promise<CreatedOrder> {
  const db = getDb();

  if (cart.shippingZone === null) {
    throw new Error("Cannot create an order without a shipping zone");
  }

  const orderNumber = await nextOrderNumber();
  const ref = publicRef();

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      publicRef: ref,
      status: "PENDING",
      email,
      shipCountry: countryCode,
      shippingZone: cart.shippingZone,
      subtotalCents: cart.subtotalCents,
      discountCents: cart.discountCents,
      shippingCents: cart.shippingCents,
      taxCents: cart.taxCents,
      totalCents: cart.totalCents,
      currency: "USD",
    })
    .returning({ id: orders.id });

  if (!order) throw new Error("Failed to create order");

  await db.insert(orderItems).values(
    cart.lines.map((line) => ({
      orderId: order.id,
      productId: line.productId,
      productName: line.name,
      productSlug: line.slug,
      sizeLabel: line.sizeLabel,
      imageUrl: line.imageUrl,
      // Line items record the normal price even for an offer line; the
      // promotional reduction lives in the order's `discountCents`. That keeps
      // the receipt reconciling as subtotal − discount + shipping + tax = total,
      // and means no line-level arithmetic can drift out of step with it.
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
      isOffer: line.isOffer,
    })),
  );

  return { id: order.id, orderNumber, publicRef: ref };
}

export async function attachStripeSession(
  orderId: number,
  sessionId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

export type ApplyPaidResult =
  | { outcome: "applied"; orderNumber: string }
  | { outcome: "skipped"; reason: string };

/**
 * Marks an order paid from a completed Stripe Checkout Session.
 *
 * Deliberately shared between the Stripe webhook and `pnpm stripe:reconcile`.
 * Two separate implementations of "mark this order paid" would eventually
 * disagree about which fields to copy across, and that disagreement would be
 * a money bug. There is one, here.
 *
 * Safe to call more than once: only a PENDING order advances, so a redelivered
 * event or a reconcile run over an already-paid order is a no-op.
 */
export async function applyPaidCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<ApplyPaidResult> {
  const rawId = session.metadata?.orderId;
  const orderId = rawId ? Number(rawId) : NaN;
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error(`session ${session.id} has no usable orderId metadata`);
  }
  if (session.payment_status !== "paid") {
    return { outcome: "skipped", reason: `payment_status is ${session.payment_status}` };
  }

  const db = getDb();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!existing) throw new Error(`order ${orderId} not found`);

  // Only PENDING advances. A refunded or canceled order is never resurrected
  // by a late event arriving out of order.
  if (existing.status !== "PENDING") {
    return { outcome: "skipped", reason: `already ${existing.status}` };
  }

  const address = session.collected_information?.shipping_details?.address ?? null;
  const shipName = session.collected_information?.shipping_details?.name ?? null;

  await db
    .update(orders)
    .set({
      status: "PAID",
      paidAt: new Date(),
      updatedAt: new Date(),
      email: session.customer_details?.email ?? existing.email,
      customerName: session.customer_details?.name ?? shipName,
      shipName: shipName ?? session.customer_details?.name ?? null,
      shipLine1: address?.line1 ?? null,
      shipLine2: address?.line2 ?? null,
      shipCity: address?.city ?? null,
      shipState: address?.state ?? null,
      shipPostalCode: address?.postal_code ?? null,
      shipCountry: address?.country ?? existing.shipCountry,
      // Stripe is authoritative on what was actually charged.
      taxCents: session.total_details?.amount_tax ?? existing.taxCents,
      totalCents: session.amount_total ?? existing.totalCents,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
    })
    .where(eq(orders.id, orderId));

  // After the status update, and never allowed to throw: the payment is
  // already recorded, so a mail failure must not undo or block it.
  await sendOrderConfirmation(orderId);

  return { outcome: "applied", orderNumber: existing.orderNumber };
}

export async function getOrderByPublicRef(ref: string) {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: eq(orders.publicRef, ref),
    with: { items: { orderBy: [asc(orderItems.id)] } },
  });
  return order ?? null;
}

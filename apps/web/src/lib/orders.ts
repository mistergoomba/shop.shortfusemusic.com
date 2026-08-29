import "server-only";
import { randomBytes } from "node:crypto";
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

export async function getOrderByPublicRef(ref: string) {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: eq(orders.publicRef, ref),
    with: { items: { orderBy: [asc(orderItems.id)] } },
  });
  return order ?? null;
}

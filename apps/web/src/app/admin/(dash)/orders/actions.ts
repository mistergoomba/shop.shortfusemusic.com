"use server";

import { revalidatePath } from "next/cache";
import { getDb, orders, eq } from "@sf/db";
import { orderUpdateInput } from "@sf/shared";
import { requireAdmin } from "@/lib/require-admin";
import { stripe } from "@/lib/stripe";

export interface OrderActionState {
  error?: string;
  ok?: string;
}

function revalidateOrder(id: number) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
}

export async function updateOrderDetails(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Bad order id." };

  const parsed = orderUpdateInput.safeParse({
    trackingNumber: String(formData.get("trackingNumber") ?? "").trim() || null,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  }

  const db = getDb();
  await db
    .update(orders)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(orders.id, id));

  revalidateOrder(id);
  return { ok: "Order updated." };
}

export async function markShipped(id: number): Promise<OrderActionState> {
  await requireAdmin();
  const db = getDb();

  const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order) return { error: "Order not found." };

  // Only a paid order can ship. Shipping a PENDING order would mean posting
  // merchandise for a payment that never confirmed.
  if (order.status !== "PAID") {
    return { error: `Can't ship an order that is ${order.status}.` };
  }

  await db
    .update(orders)
    .set({ status: "SHIPPED", shippedAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, id));

  revalidateOrder(id);
  return { ok: "Marked as shipped." };
}

export async function cancelOrder(id: number): Promise<OrderActionState> {
  await requireAdmin();
  const db = getDb();

  const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order) return { error: "Order not found." };

  // Cancelling a paid order would leave the customer's money with us and no
  // record of why. Refund it instead.
  if (order.status !== "PENDING") {
    return {
      error:
        order.status === "PAID"
          ? "This order is paid. Refund it rather than cancelling."
          : `Can't cancel an order that is ${order.status}.`,
    };
  }

  await db
    .update(orders)
    .set({ status: "CANCELED", canceledAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, id));

  revalidateOrder(id);
  return { ok: "Order canceled." };
}

/**
 * Full refund through Stripe.
 *
 * Money movement happens at Stripe first; the local status is only updated
 * once Stripe confirms. If this call fails the order stays PAID, which is the
 * safe direction to fail -- a refund that did not happen must not look like
 * one that did.
 */
export async function refundOrder(id: number): Promise<OrderActionState> {
  await requireAdmin();
  const db = getDb();

  const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order) return { error: "Order not found." };

  if (order.status !== "PAID" && order.status !== "SHIPPED") {
    return { error: `Can't refund an order that is ${order.status}.` };
  }
  if (!order.stripePaymentIntentId) {
    return { error: "No Stripe payment on this order to refund." };
  }

  try {
    const refund = await stripe().refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        reason: "requested_by_customer",
        metadata: { orderNumber: order.orderNumber },
      },
      // A double-click cannot issue two refunds for the same order.
      { idempotencyKey: `refund-order-${order.id}` },
    );

    await db
      .update(orders)
      .set({
        status: "REFUNDED",
        refundedAt: new Date(),
        updatedAt: new Date(),
        stripeRefundId: refund.id,
      })
      .where(eq(orders.id, id));

    revalidateOrder(id);
    return { ok: `Refunded ${order.orderNumber} through Stripe.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error(`[admin.refund] order ${order.orderNumber}:`, message);
    return { error: `Stripe refused the refund: ${message}` };
  }
}

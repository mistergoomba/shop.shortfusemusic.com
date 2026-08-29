"use server";

import { revalidatePath } from "next/cache";
import { getDb, orders, eq, and, isNotNull, desc } from "@sf/db";
import { applyPaidCheckoutSession } from "@/lib/orders";
import { orderUpdateInput } from "@sf/shared";
import { requireAdmin } from "@/lib/require-admin";
import { stripe } from "@/lib/stripe";
import { sendOrderConfirmation, sendOrderShipped } from "@/lib/email/send";

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

  // The order is shipped whether or not the customer can be told. Report a
  // mail failure rather than hiding it, but never undo the status change.
  const mail = await sendOrderShipped(id);
  revalidateOrder(id);

  if (!mail.ok) {
    return {
      ok: `Marked as shipped, but the notification email did not send: ${mail.reason}`,
    };
  }
  return {
    ok: order.trackingNumber
      ? "Marked as shipped and the customer has been emailed the tracking number."
      : "Marked as shipped and the customer has been emailed. No tracking number was set — add one and re-send if you have it.",
  };
}

/**
 * Asks Stripe about every PENDING order and repairs any it says were paid.
 *
 * Webhooks are the only thing that marks an order PAID, and a webhook can fail
 * to arrive: a misconfigured listener, an outage, a deploy at the wrong moment.
 * When that happens a customer has been charged for an order that still reads
 * PENDING and will never be packed. Stripe is the authority on what was
 * actually paid, so this asks it directly.
 *
 * It applies the same transition the webhook does, through the shared
 * applyPaidCheckoutSession(), so a repaired order is indistinguishable from one
 * the webhook handled -- including the confirmation email. Orders Stripe agrees
 * are unpaid are left alone; those are simply abandoned checkouts.
 */
export async function reconcilePendingOrders(): Promise<OrderActionState> {
  await requireAdmin();
  const db = getDb();

  const pending = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.status, "PENDING"), isNotNull(orders.stripeCheckoutSessionId)),
    )
    .orderBy(desc(orders.id));

  if (pending.length === 0) {
    return { ok: "No pending orders to check." };
  }

  let repaired = 0;
  let stillUnpaid = 0;
  const failures: string[] = [];

  for (const order of pending) {
    try {
      const session = await stripe().checkout.sessions.retrieve(
        order.stripeCheckoutSessionId!,
      );
      if (session.payment_status !== "paid") {
        stillUnpaid++;
        continue;
      }
      const result = await applyPaidCheckoutSession(session);
      if (result.outcome === "applied") repaired++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[admin.reconcile] ${order.orderNumber}:`, message);
      failures.push(order.orderNumber);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  const parts: string[] = [];
  if (repaired > 0) {
    parts.push(
      `Recovered ${repaired} paid ${repaired === 1 ? "order that was" : "orders that were"} stuck pending.`,
    );
  }
  if (stillUnpaid > 0) {
    parts.push(`${stillUnpaid} genuinely unpaid (abandoned checkouts).`);
  }
  if (failures.length > 0) {
    return {
      error: `Could not check ${failures.join(", ")}. ${parts.join(" ")}`,
    };
  }
  return { ok: parts.join(" ") || "Everything already matches Stripe." };
}

/** Manual re-send from admin, for when a delivery failed or bounced. */
export async function resendOrderEmail(
  id: number,
  kind: "confirmation" | "shipped",
): Promise<OrderActionState> {
  await requireAdmin();

  const result =
    kind === "confirmation"
      ? await sendOrderConfirmation(id, { force: true })
      : await sendOrderShipped(id, { force: true });

  revalidateOrder(id);
  return result.ok
    ? { ok: `Re-sent the ${kind} email.` }
    : { error: `Could not send: ${result.reason}` };
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

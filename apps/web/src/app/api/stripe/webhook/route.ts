import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb, orders, webhookEvents, eq } from "@sf/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. This is the ONLY place an order becomes PAID.
 *
 * A browser landing on the success page proves nothing -- the customer could
 * navigate there directly, or close the tab before Stripe redirects. Payment
 * status comes from a signature-verified event and nowhere else.
 *
 * Idempotency: every event id is inserted into `webhook_events` with a unique
 * constraint before it is handled. A redelivery loses the insert race and
 * returns 200 without touching the order, so Stripe's at-least-once delivery
 * cannot double-apply anything.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // The raw body is required: any reserialization invalidates the signature.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, env.stripeWebhookSecret);
  } catch (err) {
    console.error(
      "[stripe.webhook] signature verification failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const db = getDb();

  const claimed = await db
    .insert(webhookEvents)
    .values({ stripeEventId: event.id, type: event.type })
    .onConflictDoNothing({ target: webhookEvents.stripeEventId })
    .returning({ id: webhookEvents.id });

  if (claimed.length === 0) {
    // Already processed (or in flight). Acknowledge without re-applying.
    return NextResponse.json({ received: true, duplicate: true });
  }
  const eventRowId = claimed[0]!.id;

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await markPaid(event.data.object);
        break;

      case "checkout.session.expired":
        await markCanceled(event.data.object);
        break;

      case "checkout.session.async_payment_failed":
        await markCanceled(event.data.object);
        break;

      case "charge.refunded":
        await markRefunded(event.data.object);
        break;

      default:
        // Unhandled types are still recorded, so the ledger shows what arrived.
        break;
    }

    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, eventRowId));

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe.webhook] ${event.type} ${event.id} failed:`, message);

    // Record the failure and return 500 so Stripe retries. The event row stays
    // claimed but unprocessed, which is visible in admin.
    await db
      .update(webhookEvents)
      .set({ error: message })
      .where(eq(webhookEvents.id, eventRowId));

    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

function orderIdFrom(session: Stripe.Checkout.Session): number | null {
  const raw = session.metadata?.orderId;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function markPaid(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = orderIdFrom(session);
  if (orderId === null) {
    throw new Error(`checkout session ${session.id} has no usable orderId metadata`);
  }
  if (session.payment_status !== "paid") return;

  const db = getDb();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!existing) throw new Error(`order ${orderId} not found`);

  // Only PENDING advances to PAID. A refunded or canceled order is never
  // resurrected by a late event arriving out of order.
  if (existing.status !== "PENDING") return;

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
}

async function markCanceled(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = orderIdFrom(session);
  if (orderId === null) return;

  const db = getDb();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  // Never cancel an order that already took money.
  if (!existing || existing.status !== "PENDING") return;

  await db
    .update(orders)
    .set({ status: "CANCELED", canceledAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

async function markRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const db = getDb();
  const existing = await db.query.orders.findFirst({
    where: eq(orders.stripePaymentIntentId, paymentIntentId),
  });
  if (!existing) return;

  // A partial refund is a bookkeeping note, not a status change.
  const fullyRefunded = charge.amount_refunded >= charge.amount;
  if (!fullyRefunded) return;

  await db
    .update(orders)
    .set({
      status: "REFUNDED",
      refundedAt: new Date(),
      updatedAt: new Date(),
      stripeChargeId: charge.id,
    })
    .where(eq(orders.id, existing.id));
}

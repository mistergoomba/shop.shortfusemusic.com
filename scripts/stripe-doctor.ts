/**
 * Checks that Stripe is wired up correctly and that what Stripe intends to
 * charge matches what our database says the order costs.
 *
 *   pnpm stripe:doctor
 *
 * The comparison is the point. Our totals and Stripe's are computed from the
 * same priceCart() result, but they travel by different routes -- ours into
 * the orders table, Stripe's into line_items plus a shipping option. If those
 * ever disagree, a customer gets charged something we have no record of.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
config({ path: resolve(ROOT, ".env"), quiet: true });

import Stripe from "stripe";
import { createDb, orders, orderItems, eq, desc, asc } from "@sf/db";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function fail(message: string): never {
  console.error(`\n  FAIL  ${message}\n`);
  process.exit(1);
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || key === "sk_test_...") {
    fail("STRIPE_SECRET_KEY is not set (or is still the placeholder).");
  }

  const mode = key.startsWith("sk_live_") ? "LIVE" : "TEST";
  const stripe = new Stripe(key);

  console.log(`\nStripe ${mode} mode`);

  // 1. Can we actually talk to Stripe?
  const account = await stripe.accounts.retrieve();
  console.log(`  account:        ${account.id}`);
  console.log(`  charges enabled: ${account.charges_enabled}`);
  console.log(`  payouts enabled: ${account.payouts_enabled}`);

  // 2. Which payment methods will Checkout actually offer?
  const methods = await stripe.paymentMethodConfigurations.list({ limit: 1 });
  const cfg = methods.data[0];
  if (cfg) {
    const enabled = Object.entries(cfg)
      .filter(
        ([, v]) =>
          v && typeof v === "object" && "display_preference" in v &&
          (v as { display_preference: { value: string } }).display_preference
            .value !== "off",
      )
      .map(([k]) => k);
    console.log(`  payment methods: ${enabled.join(", ") || "(none reported)"}`);
  }

  // 3. Does the most recent session agree with our order record?
  const sessions = await stripe.checkout.sessions.list({
    limit: 1,
    expand: ["data.line_items"],
  });
  const session = sessions.data[0];
  if (!session) {
    console.log("\n  No checkout sessions yet — nothing to reconcile.\n");
    return;
  }

  console.log(`\nMost recent checkout session`);
  console.log(`  id:             ${session.id}`);
  console.log(`  status:         ${session.status} / ${session.payment_status}`);
  console.log(`  order metadata: ${session.metadata?.orderNumber ?? "MISSING"}`);
  console.log(`  email:          ${session.customer_email}`);
  console.log(
    `  ships to:       ${session.shipping_address_collection?.allowed_countries.join(", ") ?? "not collected"}`,
  );
  console.log(`  line items:`);
  for (const li of session.line_items?.data ?? []) {
    console.log(
      `    ${String(li.quantity).padStart(2)} x ${(li.description ?? "?").padEnd(46)} ${money(li.amount_total)}`,
    );
  }
  console.log(`  stripe total:   ${money(session.amount_total ?? 0)}`);

  const orderId = Number(session.metadata?.orderId);
  if (!Number.isInteger(orderId)) {
    fail("Session has no usable orderId in metadata — the webhook could not match it.");
  }

  const db = createDb();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: { orderBy: [asc(orderItems.id)] } },
  });
  if (!order) fail(`Order ${orderId} referenced by the session does not exist.`);

  console.log(`\nOur record of ${order.orderNumber}`);
  console.log(`  status:         ${order.status}`);
  console.log(`  subtotal:       ${money(order.subtotalCents)}`);
  console.log(`  discount:       -${money(order.discountCents)}`);
  console.log(`  shipping:       ${money(order.shippingCents)} (${order.shippingZone})`);
  console.log(`  tax:            ${money(order.taxCents)}`);
  console.log(`  total:          ${money(order.totalCents)}`);

  console.log(`\nReconciliation`);
  const stripeTotal = session.amount_total ?? 0;
  if (stripeTotal !== order.totalCents) {
    fail(
      `Stripe would charge ${money(stripeTotal)} but our order says ${money(order.totalCents)}.`,
    );
  }
  console.log(`  OK  Stripe total matches the order total exactly (${money(stripeTotal)}).`);

  // The arithmetic the receipt has to satisfy.
  const derived =
    order.subtotalCents - order.discountCents + order.shippingCents + order.taxCents;
  if (derived !== order.totalCents) {
    fail(
      `Order does not add up: ${money(order.subtotalCents)} - ${money(order.discountCents)} + ${money(order.shippingCents)} + ${money(order.taxCents)} = ${money(derived)}, not ${money(order.totalCents)}.`,
    );
  }
  console.log("  OK  subtotal - discount + shipping + tax = total.");
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nstripe:doctor failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

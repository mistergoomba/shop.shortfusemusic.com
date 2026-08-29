import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve("/Users/mistergoomba/dev/shop.shortfusemusic.com", ".env"), quiet: true });
import Stripe from "stripe";
import { createDb, orders, webhookEvents, eq, desc } from "@sf/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const secret = process.env.STRIPE_WEBHOOK_SECRET!;
const db = createDb();
const URL = "http://localhost:3000/api/stripe/webhook";

const order = await db.query.orders.findFirst({ orderBy: [desc(orders.id)] });
if (!order) throw new Error("no order to test with");
console.log(`  using ${order.orderNumber}, currently ${order.status}\n`);

function event(id: string) {
  return {
    id, object: "event", type: "checkout.session.completed",
    api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
    data: { object: {
      id: order.stripeCheckoutSessionId ?? "cs_test_synthetic",
      object: "checkout.session",
      payment_status: "paid", status: "complete",
      amount_total: order.totalCents, currency: "usd",
      payment_intent: "pi_test_synthetic_123",
      metadata: { orderId: String(order.id), orderNumber: order.orderNumber, publicRef: order.publicRef },
      customer_details: { email: order.email, name: "Test Buyer" },
      collected_information: { shipping_details: {
        name: "Test Buyer",
        address: { line1: "123 Test St", line2: null, city: "Austin", state: "TX", postal_code: "78701", country: "US" },
      }},
      total_details: { amount_tax: 0 },
    }},
  };
}

async function post(payload: object, sig?: string) {
  const body = JSON.stringify(payload);
  const header = sig ?? stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  const res = await fetch(URL, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body });
  return { status: res.status, body: await res.text() };
}

const evtId = `evt_test_${Date.now()}`;

console.log("1. FORGED signature must be rejected");
const forged = await post(event(`${evtId}_forged`), "t=123,v1=deadbeef");
console.log(`   -> ${forged.status} ${forged.body.trim()}  ${forged.status === 400 ? "OK" : "*** EXPECTED 400 ***"}\n`);

console.log("2. Valid signature, PENDING -> PAID");
const first = await post(event(evtId));
console.log(`   -> ${first.status} ${first.body.trim()}`);
let after = await db.query.orders.findFirst({ where: eq(orders.id, order.id) });
console.log(`   order is now ${after!.status}, paidAt=${after!.paidAt ? "set" : "null"}, ship=${after!.shipCity ?? "-"}, pi=${after!.stripePaymentIntentId ?? "-"}`);
console.log(`   ${after!.status === "PAID" ? "OK" : "*** EXPECTED PAID ***"}\n`);

console.log("3. REPLAY of the same event id must be a no-op");
const replay = await post(event(evtId));
console.log(`   -> ${replay.status} ${replay.body.trim()}  ${replay.body.includes("duplicate") ? "OK" : "*** EXPECTED duplicate ***"}\n`);

console.log("4. A DIFFERENT event id on an already-PAID order must not re-pay");
const paidAtBefore = after!.paidAt?.toISOString();
await post(event(`${evtId}_second`));
after = await db.query.orders.findFirst({ where: eq(orders.id, order.id) });
const unchanged = after!.paidAt?.toISOString() === paidAtBefore;
console.log(`   order still ${after!.status}, paidAt unchanged: ${unchanged}  ${unchanged ? "OK" : "*** paidAt MOVED ***"}\n`);

console.log("5. Ledger");
const rows = await db.select().from(webhookEvents);
console.log(`   webhook_events rows: ${rows.length} (forged attempt should NOT be recorded)`);
for (const r of rows) console.log(`     ${r.stripeEventId}  ${r.type}  processed=${r.processedAt ? "yes" : "no"}  err=${r.error ?? "-"}`);

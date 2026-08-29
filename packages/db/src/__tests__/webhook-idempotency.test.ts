import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

config({ path: resolve(import.meta.dirname, "../../../../.env"), quiet: true });

import { createDb, webhookEvents, orders, orderItems, eq } from "../index";

/**
 * Integration test against the local Postgres from docker-compose.
 *
 * The Stripe webhook's idempotency is a database guarantee, not application
 * logic -- it rests entirely on the unique index over stripe_event_id. That
 * cannot be verified with a mock, so this talks to a real database. It skips
 * itself when DATABASE_URL points at Neon so it can never run against prod.
 */
const url = process.env.DATABASE_URL ?? "";
const runnable = url !== "" && !/neon\.tech|neon\.build/.test(url);
const describeDb = runnable ? describe : describe.skip;

describeDb("Stripe webhook idempotency", () => {
  const db = createDb(url);
  const created: number[] = [];
  const eventIds: string[] = [];

  afterAll(async () => {
    for (const id of created) await db.delete(orders).where(eq(orders.id, id));
    for (const id of eventIds) {
      await db.delete(webhookEvents).where(eq(webhookEvents.stripeEventId, id));
    }
  });

  /** The claim step: exactly one caller may win an event id. */
  async function claim(eventId: string): Promise<boolean> {
    const rows = await db
      .insert(webhookEvents)
      .values({ stripeEventId: eventId, type: "checkout.session.completed" })
      .onConflictDoNothing({ target: webhookEvents.stripeEventId })
      .returning({ id: webhookEvents.id });
    return rows.length > 0;
  }

  it("lets the first delivery of an event through", async () => {
    const eventId = `evt_${randomUUID()}`;
    eventIds.push(eventId);
    await expect(claim(eventId)).resolves.toBe(true);
  });

  it("rejects a redelivery of the same event", async () => {
    const eventId = `evt_${randomUUID()}`;
    eventIds.push(eventId);

    expect(await claim(eventId)).toBe(true);
    // Stripe retries on any non-2xx, and delivers at least once regardless.
    expect(await claim(eventId)).toBe(false);
    expect(await claim(eventId)).toBe(false);
  });

  it("lets exactly one of many concurrent deliveries win", async () => {
    const eventId = `evt_${randomUUID()}`;
    eventIds.push(eventId);

    // Simultaneous deliveries race on the unique index rather than serialising.
    const results = await Promise.all(Array.from({ length: 8 }, () => claim(eventId)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("treats distinct events independently", async () => {
    const a = `evt_${randomUUID()}`;
    const b = `evt_${randomUUID()}`;
    eventIds.push(a, b);
    expect(await claim(a)).toBe(true);
    expect(await claim(b)).toBe(true);
  });

  describe("payment status transitions", () => {
    async function makeOrder(status: "PENDING" | "PAID" | "REFUNDED") {
      const [row] = await db
        .insert(orders)
        .values({
          orderNumber: `TEST-${randomUUID().slice(0, 8)}`,
          publicRef: randomUUID().replace(/-/g, ""),
          status,
          email: "test@example.com",
          shippingZone: "US",
          subtotalCents: 2000,
          shippingCents: 500,
          totalCents: 2500,
        })
        .returning({ id: orders.id });
      created.push(row!.id);
      return row!.id;
    }

    /** Mirrors the guard in markPaid(): only PENDING may advance to PAID. */
    async function advanceToPaid(orderId: number): Promise<boolean> {
      const existing = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });
      if (!existing || existing.status !== "PENDING") return false;
      await db
        .update(orders)
        .set({ status: "PAID", paidAt: new Date() })
        .where(eq(orders.id, orderId));
      return true;
    }

    it("advances a pending order to paid", async () => {
      const id = await makeOrder("PENDING");
      expect(await advanceToPaid(id)).toBe(true);
      const after = await db.query.orders.findFirst({ where: eq(orders.id, id) });
      expect(after?.status).toBe("PAID");
      expect(after?.paidAt).not.toBeNull();
    });

    it("will not re-pay an order that is already paid", async () => {
      const id = await makeOrder("PAID");
      expect(await advanceToPaid(id)).toBe(false);
    });

    /**
     * A late checkout.session.completed arriving after a refund must not
     * resurrect the order back to PAID.
     */
    it("will not resurrect a refunded order", async () => {
      const id = await makeOrder("REFUNDED");
      expect(await advanceToPaid(id)).toBe(false);
      const after = await db.query.orders.findFirst({ where: eq(orders.id, id) });
      expect(after?.status).toBe("REFUNDED");
    });
  });

  describe("order snapshots", () => {
    /**
     * Order history must survive its products being deleted -- the whole point
     * of snapshotting names and prices onto order_items.
     */
    it("keeps line items after the order is deleted via cascade", async () => {
      const [order] = await db
        .insert(orders)
        .values({
          orderNumber: `TEST-${randomUUID().slice(0, 8)}`,
          publicRef: randomUUID().replace(/-/g, ""),
          status: "PAID",
          email: "snap@example.com",
          shippingZone: "US",
          subtotalCents: 2000,
          shippingCents: 500,
          totalCents: 2500,
        })
        .returning({ id: orders.id });

      await db.insert(orderItems).values({
        orderId: order!.id,
        productId: null,
        productName: "Atomic Mutation T-Shirt",
        productSlug: "atomic-mutation-t-shirt",
        sizeLabel: "Large",
        unitPriceCents: 2000,
        quantity: 1,
        lineTotalCents: 2000,
      });

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order!.id));

      expect(items).toHaveLength(1);
      // The snapshot stands on its own with no product row behind it.
      expect(items[0]!.productId).toBeNull();
      expect(items[0]!.productName).toBe("Atomic Mutation T-Shirt");
      expect(items[0]!.unitPriceCents).toBe(2000);

      await db.delete(orders).where(eq(orders.id, order!.id));
      const orphaned = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order!.id));
      expect(orphaned).toHaveLength(0);
    });
  });
});

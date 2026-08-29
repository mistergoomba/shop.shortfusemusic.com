import "server-only";
import { Resend } from "resend";
import { getDb, orders, orderItems, storeSettings, eq, asc } from "@sf/db";
import { parseEmailList } from "@sf/shared";
import { env } from "../env";
import {
  merchantOrderAlertEmail,
  orderConfirmationEmail,
  orderShippedEmail,
  type EmailOrder,
} from "./templates";

/**
 * Transactional email via Resend.
 *
 * The governing rule: **sending email must never break an order.** Every entry
 * point here catches its own failures and reports them as a value. A webhook
 * that already marked an order PAID must return 200 even if Resend is down --
 * throwing would make Stripe retry an event we already applied, and would turn
 * a mail outage into an order-processing outage.
 *
 * Whether a message actually went out is recorded on the order
 * (`confirmationEmailSentAt` / `shippedEmailSentAt`), so a failure is visible
 * in admin and can be re-sent by hand rather than silently vanishing.
 */

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: string };

let client: Resend | undefined;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

/**
 * Resend will only deliver to arbitrary recipients from a verified domain.
 * Until shortfusemusic.com is verified, `onboarding@resend.dev` works but can
 * only reach the Resend account owner's own address.
 */
function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Short Fuse <onboarding@resend.dev>";
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

async function loadEmailOrder(orderId: number): Promise<EmailOrder | null> {
  const db = getDb();
  const row = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: { orderBy: [asc(orderItems.id)] } },
  });
  if (!row) return null;

  return {
    orderNumber: row.orderNumber,
    publicRef: row.publicRef,
    email: row.email,
    customerName: row.customerName,
    items: row.items.map((i) => ({
      productName: i.productName,
      sizeLabel: i.sizeLabel,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      lineTotalCents: i.lineTotalCents,
      isOffer: i.isOffer,
    })),
    subtotalCents: row.subtotalCents,
    discountCents: row.discountCents,
    shippingCents: row.shippingCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    shipName: row.shipName,
    shipLine1: row.shipLine1,
    shipLine2: row.shipLine2,
    shipCity: row.shipCity,
    shipState: row.shipState,
    shipPostalCode: row.shipPostalCode,
    shipCountry: row.shipCountry,
    trackingNumber: row.trackingNumber,
  };
}

async function deliver(
  to: string,
  message: { subject: string; html: string; text: string },
  logContext: string,
): Promise<SendResult> {
  const api = resend();
  if (!api) {
    console.warn(`[email] ${logContext}: RESEND_API_KEY not set, skipping send`);
    return { ok: false, reason: "RESEND_API_KEY is not configured" };
  }

  try {
    const { data, error } = await api.emails.send({
      from: fromAddress(),
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    });

    if (error) {
      console.error(`[email] ${logContext} rejected:`, error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${logContext} threw:`, reason);
    return { ok: false, reason };
  }
}

/**
 * Order confirmation. Called from the Stripe webhook once payment is
 * confirmed, and re-sendable from admin.
 *
 * `force` skips the already-sent guard, which is what the admin re-send button
 * uses. Without it a second call is a no-op, so a webhook redelivery cannot
 * mail the customer twice.
 */
export async function sendOrderConfirmation(
  orderId: number,
  { force = false }: { force?: boolean } = {},
): Promise<SendResult> {
  const db = getDb();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!existing) return { ok: false, reason: "Order not found" };
  if (existing.confirmationEmailSentAt && !force) {
    return { ok: false, reason: "Confirmation already sent" };
  }

  const order = await loadEmailOrder(orderId);
  if (!order) return { ok: false, reason: "Order not found" };

  const result = await deliver(
    order.email,
    orderConfirmationEmail(order, env.siteUrl),
    `confirmation ${order.orderNumber}`,
  );

  if (result.ok) {
    await db
      .update(orders)
      .set({ confirmationEmailSentAt: new Date(), confirmationEmailId: result.id })
      .where(eq(orders.id, orderId));
    console.log(`[email] confirmation ${order.orderNumber} accepted, id=${result.id}`);
  }
  return result;
}

/** Shipping notification. Sent when an order is marked shipped in admin. */
export async function sendOrderShipped(
  orderId: number,
  { force = false }: { force?: boolean } = {},
): Promise<SendResult> {
  const db = getDb();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!existing) return { ok: false, reason: "Order not found" };
  if (existing.shippedEmailSentAt && !force) {
    return { ok: false, reason: "Shipping notice already sent" };
  }

  const order = await loadEmailOrder(orderId);
  if (!order) return { ok: false, reason: "Order not found" };

  const result = await deliver(
    order.email,
    orderShippedEmail(order, env.siteUrl),
    `shipped ${order.orderNumber}`,
  );

  if (result.ok) {
    await db
      .update(orders)
      .set({ shippedEmailSentAt: new Date(), shippedEmailId: result.id })
      .where(eq(orders.id, orderId));
    console.log(`[email] shipped ${order.orderNumber} accepted, id=${result.id}`);
  }
  return result;
}

/**
 * Alerts the band that an order came in.
 *
 * Recipients come from Store Settings, falling back to the contact email, so
 * nobody has to redeploy to add a bandmate. Sent alongside the customer's
 * confirmation and under the same rule: it can never break the order.
 *
 * All recipients go on one send. Resend accepts an array, and one message to
 * three people is both cheaper and easier to reason about than three sends
 * that could half-fail.
 */
export async function sendMerchantOrderAlert(
  orderId: number,
  { force = false }: { force?: boolean } = {},
): Promise<SendResult> {
  const db = getDb();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!existing) return { ok: false, reason: "Order not found" };
  if (existing.merchantNotifiedAt && !force) {
    return { ok: false, reason: "Already notified" };
  }

  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1));

  const recipients = parseEmailList(settings?.orderNotificationEmails);
  const to = recipients.length > 0 ? recipients : [settings?.contactEmail].filter(Boolean) as string[];
  if (to.length === 0) {
    return { ok: false, reason: "No notification recipients configured" };
  }

  const order = await loadEmailOrder(orderId);
  if (!order) return { ok: false, reason: "Order not found" };

  const api = resend();
  if (!api) {
    console.warn(`[email] merchant alert ${order.orderNumber}: RESEND_API_KEY not set`);
    return { ok: false, reason: "RESEND_API_KEY is not configured" };
  }

  const message = merchantOrderAlertEmail(
    order,
    env.siteUrl,
    `${env.siteUrl}/admin/orders/${orderId}`,
  );

  try {
    const { data, error } = await api.emails.send({
      from: fromAddress(),
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      // So hitting reply goes to the customer, not into the void.
      replyTo: order.email,
    });
    if (error) {
      console.error(`[email] merchant alert ${order.orderNumber} rejected:`, error.message);
      return { ok: false, reason: error.message };
    }
    await db
      .update(orders)
      .set({ merchantNotifiedAt: new Date() })
      .where(eq(orders.id, orderId));
    console.log(
      `[email] merchant alert ${order.orderNumber} accepted, id=${data?.id}, to=${to.join(", ")}`,
    );
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[email] merchant alert ${order.orderNumber} threw:`, reason);
    return { ok: false, reason };
  }
}

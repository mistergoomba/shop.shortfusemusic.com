import { formatCents, SIZE_SHORT_LABEL } from "@sf/shared";

/**
 * Hand-written email HTML rather than a rendering library.
 *
 * Email clients are not browsers: Outlook still uses Word's rendering engine,
 * Gmail strips <style> blocks, and flexbox/grid are unreliable. So these use
 * tables for layout and inline styles for everything, which is the boring
 * thing that actually works everywhere. Every email also ships a plain-text
 * alternative -- some clients show it, and it keeps us out of spam filters.
 */

export interface EmailOrderItem {
  productName: string;
  sizeLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  isOffer: boolean;
}

export interface EmailOrder {
  orderNumber: string;
  publicRef: string;
  email: string;
  customerName: string | null;
  items: EmailOrderItem[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shipName: string | null;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
  trackingNumber: string | null;
}

const INK = "#0a0908";
const CARD = "#141210";
const BONE = "#e9e5de";
const DIM = "#9c948a";
const BLOOD = "#c1121f";
const LINE = "#2a2724";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

function shell(siteUrl: string, heading: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${INK};color:${BONE};font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CARD};border:1px solid ${LINE};">
    <tr><td style="padding:28px 24px 8px;text-align:center;">
      <a href="${siteUrl}" style="color:${BLOOD};text-decoration:none;font-size:26px;font-weight:bold;letter-spacing:2px;">SHORT FUSE</a>
    </td></tr>
    <tr><td style="padding:8px 24px 24px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:${BONE};text-transform:uppercase;letter-spacing:1px;">${esc(heading)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:18px 24px 26px;border-top:1px solid ${LINE};">
      <p style="margin:0;font-size:12px;color:${DIM};line-height:1.6;">
        Questions? Just reply to this email.<br>
        <a href="${siteUrl}" style="color:${BLOOD};">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function itemRows(items: EmailOrderItem[]): string {
  return items
    .map((i) => {
      const size = i.sizeLabel
        ? ` <span style="color:${DIM};">(${esc(SIZE_SHORT_LABEL[i.sizeLabel] ?? i.sizeLabel)})</span>`
        : "";
      const tag = i.isOffer
        ? ` <span style="color:${BLOOD};font-size:11px;">ADD-ON</span>`
        : "";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${BONE};">
          ${esc(i.productName)}${size}${tag}<br>
          <span style="color:${DIM};font-size:12px;">Qty ${i.quantity} &middot; ${formatCents(i.unitPriceCents)} each</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${BONE};text-align:right;vertical-align:top;white-space:nowrap;">
          ${formatCents(i.lineTotalCents)}
        </td>
      </tr>`;
    })
    .join("");
}

function totalRow(label: string, value: string, opts: { strong?: boolean; accent?: boolean } = {}) {
  const color = opts.accent ? BLOOD : BONE;
  const weight = opts.strong ? "bold" : "normal";
  const size = opts.strong ? "16px" : "14px";
  return `<tr>
    <td style="padding:4px 0;font-size:${size};color:${DIM};">${esc(label)}</td>
    <td style="padding:4px 0;font-size:${size};color:${color};font-weight:${weight};text-align:right;white-space:nowrap;">${esc(value)}</td>
  </tr>`;
}

function addressBlock(o: EmailOrder): string {
  if (!o.shipLine1) return "";
  const parts = [
    o.shipName,
    o.shipLine1,
    o.shipLine2,
    [o.shipCity, o.shipState, o.shipPostalCode].filter(Boolean).join(", "),
    o.shipCountry,
  ].filter(Boolean) as string[];
  return `<p style="margin:20px 0 0;font-size:13px;color:${DIM};line-height:1.7;">
    <strong style="color:${BONE};">Shipping to</strong><br>${parts.map(esc).join("<br>")}
  </p>`;
}

function totalsTable(o: EmailOrder): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
    ${totalRow("Subtotal", formatCents(o.subtotalCents))}
    ${o.discountCents > 0 ? totalRow("Add-on discount", `-${formatCents(o.discountCents)}`, { accent: true }) : ""}
    ${totalRow("Shipping", o.shippingCents === 0 ? "Free" : formatCents(o.shippingCents))}
    ${o.taxCents > 0 ? totalRow("Tax", formatCents(o.taxCents)) : ""}
    ${totalRow("Total", formatCents(o.totalCents), { strong: true, accent: true })}
  </table>`;
}

/* ------------------------------------------------------------------ */
/* Order confirmation                                                  */
/* ------------------------------------------------------------------ */

export function orderConfirmationEmail(o: EmailOrder, siteUrl: string) {
  const orderUrl = `${siteUrl}/order/${o.publicRef}`;
  const name = o.customerName ? esc(o.customerName.split(" ")[0]!) : "there";

  const body = `
    <p style="margin:0 0 18px;font-size:15px;color:${BONE};line-height:1.6;">
      Thanks ${name} &mdash; we got your order and we're on it.
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:${DIM};">
      Order <strong style="color:${BLOOD};">${esc(o.orderNumber)}</strong>
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(o.items)}</table>
    ${totalsTable(o)}
    ${addressBlock(o)}
    <p style="margin:24px 0 0;">
      <a href="${orderUrl}" style="display:inline-block;background:${BLOOD};color:${BONE};text-decoration:none;padding:12px 22px;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Track your order</a>
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:${DIM};line-height:1.6;">
      We pack and ship by hand, usually within a few days. You'll get another
      email with tracking as soon as it goes out.
    </p>`;

  const text = [
    `Thanks ${o.customerName ?? "there"} - we got your order and we're on it.`,
    ``,
    `Order ${o.orderNumber}`,
    ``,
    ...o.items.map(
      (i) =>
        `  ${i.quantity} x ${i.productName}${i.sizeLabel ? ` (${i.sizeLabel})` : ""}${i.isOffer ? " [add-on]" : ""}  ${formatCents(i.lineTotalCents)}`,
    ),
    ``,
    `  Subtotal: ${formatCents(o.subtotalCents)}`,
    ...(o.discountCents > 0 ? [`  Add-on discount: -${formatCents(o.discountCents)}`] : []),
    `  Shipping: ${o.shippingCents === 0 ? "Free" : formatCents(o.shippingCents)}`,
    ...(o.taxCents > 0 ? [`  Tax: ${formatCents(o.taxCents)}`] : []),
    `  Total: ${formatCents(o.totalCents)}`,
    ``,
    `Track your order: ${orderUrl}`,
    ``,
    `We pack and ship by hand, usually within a few days. You'll get another`,
    `email with tracking as soon as it goes out.`,
  ].join("\n");

  return {
    subject: `Order ${o.orderNumber} confirmed — Short Fuse`,
    html: shell(siteUrl, "Order confirmed", body),
    text,
  };
}

/* ------------------------------------------------------------------ */
/* Shipped                                                             */
/* ------------------------------------------------------------------ */

export function orderShippedEmail(o: EmailOrder, siteUrl: string) {
  const orderUrl = `${siteUrl}/order/${o.publicRef}`;
  const name = o.customerName ? esc(o.customerName.split(" ")[0]!) : "there";

  const tracking = o.trackingNumber
    ? `<p style="margin:0 0 20px;font-size:14px;color:${DIM};">
         Tracking number<br>
         <strong style="color:${BLOOD};font-size:18px;letter-spacing:1px;">${esc(o.trackingNumber)}</strong>
       </p>`
    : "";

  const body = `
    <p style="margin:0 0 18px;font-size:15px;color:${BONE};line-height:1.6;">
      Good news ${name} &mdash; your order is on its way.
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:${DIM};">
      Order <strong style="color:${BLOOD};">${esc(o.orderNumber)}</strong>
    </p>
    ${tracking}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(o.items)}</table>
    ${addressBlock(o)}
    <p style="margin:24px 0 0;">
      <a href="${orderUrl}" style="display:inline-block;background:${BLOOD};color:${BONE};text-decoration:none;padding:12px 22px;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">View your order</a>
    </p>`;

  const text = [
    `Good news ${o.customerName ?? "there"} - your order is on its way.`,
    ``,
    `Order ${o.orderNumber}`,
    ...(o.trackingNumber ? [``, `Tracking number: ${o.trackingNumber}`] : []),
    ``,
    ...o.items.map(
      (i) =>
        `  ${i.quantity} x ${i.productName}${i.sizeLabel ? ` (${i.sizeLabel})` : ""}`,
    ),
    ``,
    `View your order: ${orderUrl}`,
  ].join("\n");

  return {
    subject: `Order ${o.orderNumber} has shipped — Short Fuse`,
    html: shell(siteUrl, "Your order shipped", body),
    text,
  };
}

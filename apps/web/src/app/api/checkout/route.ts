import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { blockingIssues } from "@sf/core";
import { checkoutSessionInput } from "@sf/shared";
import { apiError, parseBody, serverError } from "@/lib/api";
import { env, stripeConfigured } from "@/lib/env";
import { isSupportedCountry } from "@/lib/countries";
import { attachStripeSession, createPendingOrder } from "@/lib/orders";
import { priceCartFromDatabase } from "@/lib/price-cart-server";
import { stripe } from "@/lib/stripe";
import { getStoreSettings } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a Stripe Checkout Session for the cart.
 *
 * The browser's cart is treated purely as a request. Every price, every stock
 * check and the shipping rate are recomputed here from the database, and the
 * Stripe line items are built from THAT result -- so what Stripe charges can
 * only ever be what the server calculated.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return apiError(
      503,
      "stripe_unconfigured",
      "Checkout isn't available yet. Please try again later.",
    );
  }

  const parsed = await parseBody(request, checkoutSessionInput);
  if (!parsed.ok) return parsed.response;
  const { lines, acceptedOfferId, email, countryCode } = parsed.data;

  if (!isSupportedCountry(countryCode)) {
    return apiError(
      400,
      "unsupported_country",
      "We don't ship to that country yet.",
    );
  }

  try {
    const cart = await priceCartFromDatabase({
      lines,
      acceptedOfferId,
      countryCode,
    });

    // Anything wrong with an actual item stops the sale. Offer problems do
    // not: the offer simply drops off and the rest of the order proceeds.
    const blocking = blockingIssues(cart);
    if (blocking.length > 0) {
      return NextResponse.json(
        {
          error: "cart_invalid",
          message: "Your cart changed. Please review it and try again.",
          issues: blocking,
        },
        { status: 409 },
      );
    }

    const settings = await getStoreSettings();
    const order = await createPendingOrder({ cart, email, countryCode });

    /**
     * Stripe line items come from the priced cart, not the request. The offer
     * line is charged at its promotional price here, which is exactly
     * `subtotal − discount` across the whole cart.
     */
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.lines.map(
      (line) => ({
        quantity: line.quantity,
        price_data: {
          currency: "usd",
          unit_amount: line.isOffer
            ? line.unitPriceCents - cart.discountCents
            : line.unitPriceCents,
          product_data: {
            name: line.sizeLabel ? `${line.name} (${line.sizeLabel})` : line.name,
            ...(line.imageUrl?.startsWith("https://")
              ? { images: [line.imageUrl] }
              : {}),
          },
        },
      }),
    );

    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        customer_email: email,

        // Locked to the country we just quoted. Without this a customer could
        // be quoted the US rate and then ship the parcel to Australia.
        shipping_address_collection: { allowed_countries: [countryCode as never] },

        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: cart.freeShippingApplied
                ? "Free shipping"
                : `Flat rate shipping (${cart.shippingZone})`,
              fixed_amount: { amount: cart.shippingCents, currency: "usd" },
            },
          },
        ],

        // Tax is off for v1 -- the band is not registered to collect. Turning
        // this on later is a one-line change plus a Stripe dashboard setting.
        automatic_tax: { enabled: false },

        success_url: `${env.siteUrl}/order/${order.publicRef}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.siteUrl}/cart`,

        // The webhook uses these to find the order without trusting the URL.
        metadata: {
          orderId: String(order.id),
          orderNumber: order.orderNumber,
          publicRef: order.publicRef,
        },
        payment_intent_data: {
          description: `${settings.storeName} ${order.orderNumber}`,
          metadata: { orderId: String(order.id), orderNumber: order.orderNumber },
        },
      },
      // Retrying this request cannot create a second session for the order.
      { idempotencyKey: `order-${order.id}` },
    );

    await attachStripeSession(order.id, session.id);

    if (!session.url) {
      return serverError("checkout.no_url", new Error("Stripe returned no URL"));
    }

    return NextResponse.json({
      url: session.url,
      orderNumber: order.orderNumber,
      publicRef: order.publicRef,
    });
  } catch (err) {
    return serverError("checkout.create", err);
  }
}

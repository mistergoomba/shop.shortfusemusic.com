import { isPurchasable, type CartLineInput } from "@sf/shared";
import { compareAtPriceCents, effectiveUnitPriceCents } from "./pricing";
import { isOfferPresentable, type OfferCartContext } from "./offers";
import { quoteShipping } from "./shipping";
import type {
  AuthoritativeOffer,
  AuthoritativeProduct,
  CartIssue,
  PricedCart,
  PricedLine,
  ShippingSettings,
} from "./types";

export interface PriceCartArgs {
  lines: CartLineInput[];
  acceptedOfferId: number | null;
  /** ISO-3166 alpha-2. Null on the cart page, required at checkout. */
  countryCode: string | null;
  productsById: Map<number, AuthoritativeProduct>;
  offersById: Map<number, AuthoritativeOffer>;
  settings: ShippingSettings;
}

/**
 * The single source of truth for what a cart costs.
 *
 * Everything it needs is passed in already loaded from the database; it does
 * no I/O and holds no framework dependency, which is what makes the money
 * rules cheap to test exhaustively. The browser contributes only product ids,
 * size ids, quantities, an offer id, and a country -- never a price.
 *
 * Invalid lines are dropped and reported in `issues` rather than throwing, so
 * the cart page can render "this sold out while you were shopping". Checkout
 * treats any issue as fatal.
 */
export function priceCart(args: PriceCartArgs): PricedCart {
  const { lines, acceptedOfferId, countryCode, productsById, offersById, settings } =
    args;

  const issues: CartIssue[] = [];
  const priced: PricedLine[] = [];

  // ---- 1. Validate and price each requested line -------------------------
  for (const line of lines) {
    const product = productsById.get(line.productId);

    if (!product) {
      issues.push({
        code: "PRODUCT_NOT_FOUND",
        message: "That item is no longer in the store.",
        productId: line.productId,
      });
      continue;
    }
    if (!product.active) {
      issues.push({
        code: "PRODUCT_INACTIVE",
        message: `${product.name} is no longer available.`,
        productId: product.id,
      });
      continue;
    }

    const hasSizes = product.sizes.length > 0;
    let sizeLabel: string | null = null;
    let lineAvailability = product.availability;

    if (hasSizes) {
      if (line.sizeId === null) {
        issues.push({
          code: "SIZE_REQUIRED",
          message: `Pick a size for ${product.name}.`,
          productId: product.id,
        });
        continue;
      }
      const size = product.sizes.find((s) => s.id === line.sizeId);
      if (!size) {
        issues.push({
          code: "SIZE_NOT_FOUND",
          message: `That size of ${product.name} is no longer offered.`,
          productId: product.id,
          sizeId: line.sizeId,
        });
        continue;
      }
      if (!isPurchasable(size.availability)) {
        issues.push({
          code: "SIZE_SOLD_OUT",
          message: `${product.name} (${size.label}) is sold out.`,
          productId: product.id,
          sizeId: size.id,
        });
        continue;
      }
      sizeLabel = size.label;
      // For a sized product the size is authoritative, not the product rollup.
      lineAvailability = size.availability;
    } else {
      if (line.sizeId !== null) {
        issues.push({
          code: "SIZE_NOT_APPLICABLE",
          message: `${product.name} does not come in sizes.`,
          productId: product.id,
          sizeId: line.sizeId,
        });
        continue;
      }
      if (!isPurchasable(product.availability)) {
        issues.push({
          code: "PRODUCT_SOLD_OUT",
          message: `${product.name} is sold out.`,
          productId: product.id,
        });
        continue;
      }
    }

    const unitPriceCents = effectiveUnitPriceCents(product);
    priced.push({
      productId: product.id,
      sizeId: line.sizeId,
      name: product.name,
      slug: product.slug,
      sizeLabel,
      imageUrl: product.primaryImageUrl,
      unitPriceCents,
      compareAtCents: compareAtPriceCents(product),
      quantity: line.quantity,
      lineTotalCents: unitPriceCents * line.quantity,
      isOffer: false,
      availability: lineAvailability,
    });
  }

  const merchandiseSubtotal = priced.reduce((sum, l) => sum + l.lineTotalCents, 0);

  // ---- 2. Re-verify the accepted offer against the real cart --------------
  let discountCents = 0;
  let appliedOfferId: number | null = null;

  if (acceptedOfferId !== null) {
    const offer = offersById.get(acceptedOfferId);
    const offerProduct = offer ? productsById.get(offer.productId) : undefined;

    const ctx: OfferCartContext = {
      productIds: new Set(priced.map((l) => l.productId)),
      categoryIds: new Set(
        priced
          .map((l) => productsById.get(l.productId)?.categoryId)
          .filter((id): id is number => id != null),
      ),
      subtotalCents: merchandiseSubtotal,
    };

    if (!offer) {
      issues.push({
        code: "OFFER_NOT_FOUND",
        message: "That add-on is no longer available.",
        offerId: acceptedOfferId,
      });
    } else if (!offer.active) {
      issues.push({
        code: "OFFER_INACTIVE",
        message: `"${offer.name}" has ended.`,
        offerId: offer.id,
      });
    } else if (!offerProduct || !isOfferPresentable(offer, offerProduct, ctx)) {
      // Distinguish "cart no longer qualifies" from "the item itself is gone",
      // because only the first is something the customer can fix.
      const productUsable =
        offerProduct &&
        offerProduct.active &&
        isPurchasable(offerProduct.availability) &&
        offerProduct.sizes.length === 0;
      issues.push(
        productUsable
          ? {
              code: "OFFER_NOT_ELIGIBLE",
              message: `Your cart no longer qualifies for "${offer.name}".`,
              offerId: offer.id,
            }
          : {
              code: "OFFER_PRODUCT_UNAVAILABLE",
              message: `"${offer.name}" is sold out.`,
              offerId: offer.id,
            },
      );
    } else {
      const normalUnit = effectiveUnitPriceCents(offerProduct);
      // Never let a misconfigured offer price *above* the normal price turn
      // into a negative discount that silently overcharges.
      const savings = Math.max(0, normalUnit - offer.offerPriceCents);

      priced.push({
        productId: offerProduct.id,
        sizeId: null,
        name: offerProduct.name,
        slug: offerProduct.slug,
        sizeLabel: null,
        imageUrl: offerProduct.primaryImageUrl,
        unitPriceCents: normalUnit,
        compareAtCents: null,
        quantity: 1,
        lineTotalCents: normalUnit,
        isOffer: true,
        availability: offerProduct.availability,
      });

      discountCents = savings;
      appliedOfferId = offer.id;
    }
  }

  // ---- 3. Totals ---------------------------------------------------------
  const subtotalCents = priced.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const afterDiscount = subtotalCents - discountCents;

  if (priced.length === 0) {
    issues.push({ code: "EMPTY_CART", message: "Your cart is empty." });
  }

  let shippingCents = 0;
  let shippingZone: PricedCart["shippingZone"] = null;
  let freeShippingApplied = false;
  let amountToFreeShippingCents: number | null = null;

  if (countryCode) {
    const quote = quoteShipping(countryCode, afterDiscount, settings);
    if (quote.blocked) {
      issues.push({
        code: "INTERNATIONAL_DISABLED",
        message: "We are not shipping outside the US and Canada right now.",
      });
    }
    shippingZone = quote.zone;
    shippingCents = quote.shippingCents;
    freeShippingApplied = quote.freeShippingApplied;
    amountToFreeShippingCents = quote.amountToFreeShippingCents;
  } else if (settings.freeShippingThresholdCents !== null) {
    // No destination yet, but we can still show progress toward free shipping.
    amountToFreeShippingCents = Math.max(
      0,
      settings.freeShippingThresholdCents - afterDiscount,
    );
    freeShippingApplied = amountToFreeShippingCents === 0;
  }

  // Tax is intentionally zero for v1 -- the band is not registered to collect
  // anywhere. The field exists so enabling Stripe Tax later is a config change
  // rather than a schema migration.
  const taxCents = 0;

  return {
    lines: priced,
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: afterDiscount + shippingCents + taxCents,
    shippingZone,
    freeShippingApplied,
    amountToFreeShippingCents,
    appliedOfferId,
    issues,
  };
}

/** Issues that must block checkout, as opposed to being shown on the cart. */
export function blockingIssues(cart: PricedCart): CartIssue[] {
  return cart.issues.filter(
    (i) =>
      i.code !== "OFFER_NOT_ELIGIBLE" &&
      i.code !== "OFFER_INACTIVE" &&
      i.code !== "OFFER_NOT_FOUND" &&
      i.code !== "OFFER_PRODUCT_UNAVAILABLE",
  );
}

import { zoneForCountry, type ShippingZone } from "@sf/shared";
import type { ShippingSettings } from "./types";

export interface ShippingQuote {
  zone: ShippingZone;
  shippingCents: number;
  freeShippingApplied: boolean;
  /** Remaining spend to unlock free shipping, or null when not configured. */
  amountToFreeShippingCents: number | null;
  /** True when the destination is blocked by internationalShippingEnabled. */
  blocked: boolean;
}

/** Base flat rate for a zone, before any free-shipping threshold. */
export function baseRateForZone(
  zone: ShippingZone,
  settings: ShippingSettings,
): number {
  switch (zone) {
    case "US":
      return settings.shippingUsCents;
    case "CA":
      return settings.shippingCaCents;
    case "INTL":
      return settings.shippingIntlCents;
  }
}

/**
 * Flat-rate shipping for one destination.
 *
 * `merchandiseCents` is the post-discount merchandise total: a cart offer
 * lowers what the customer pays, so it should also lower what counts toward
 * the free-shipping threshold. Shipping itself never counts toward it.
 *
 * Adding a zone later means extending the ShippingZone union and adding a
 * rate column -- checkout does not change.
 */
export function quoteShipping(
  countryCode: string,
  merchandiseCents: number,
  settings: ShippingSettings,
): ShippingQuote {
  const zone = zoneForCountry(countryCode);

  if (zone === "INTL" && !settings.internationalShippingEnabled) {
    return {
      zone,
      shippingCents: 0,
      freeShippingApplied: false,
      amountToFreeShippingCents: null,
      blocked: true,
    };
  }

  const base = baseRateForZone(zone, settings);
  const threshold = settings.freeShippingThresholdCents;

  if (threshold === null) {
    return {
      zone,
      shippingCents: base,
      freeShippingApplied: false,
      amountToFreeShippingCents: null,
      blocked: false,
    };
  }

  if (merchandiseCents >= threshold) {
    return {
      zone,
      shippingCents: 0,
      freeShippingApplied: true,
      amountToFreeShippingCents: 0,
      blocked: false,
    };
  }

  return {
    zone,
    shippingCents: base,
    freeShippingApplied: false,
    amountToFreeShippingCents: threshold - merchandiseCents,
    blocked: false,
  };
}

/**
 * Countries Stripe Checkout is allowed to collect an address for. We lock the
 * session to the single country the customer already told us, because the
 * shipping rate was computed from it -- letting them switch country at Stripe
 * would let them pay a US rate for an international parcel.
 */
export function allowedCountriesForZone(countryCode: string): string[] {
  return [countryCode.trim().toUpperCase()];
}

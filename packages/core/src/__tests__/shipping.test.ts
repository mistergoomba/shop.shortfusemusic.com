import { describe, expect, it } from "vitest";
import { zoneForCountry } from "@sf/shared";
import { allowedCountriesForZone, baseRateForZone, quoteShipping } from "../shipping";
import { settings } from "./fixtures";

describe("zoneForCountry", () => {
  it("maps US and CA to their own zones and everything else to INTL", () => {
    expect(zoneForCountry("US")).toBe("US");
    expect(zoneForCountry("CA")).toBe("CA");
    expect(zoneForCountry("GB")).toBe("INTL");
    expect(zoneForCountry("JP")).toBe("INTL");
  });

  it("is case and whitespace insensitive", () => {
    expect(zoneForCountry(" us ")).toBe("US");
    expect(zoneForCountry("ca")).toBe("CA");
  });
});

describe("quoteShipping", () => {
  it("charges the configured flat rate per zone", () => {
    expect(quoteShipping("US", 5000, settings).shippingCents).toBe(500);
    expect(quoteShipping("CA", 5000, settings).shippingCents).toBe(1500);
    expect(quoteShipping("DE", 5000, settings).shippingCents).toBe(2500);
  });

  it("blocks international destinations when they are turned off", () => {
    const closed = { ...settings, internationalShippingEnabled: false };
    const quote = quoteShipping("DE", 5000, closed);
    expect(quote.blocked).toBe(true);

    // US and Canada must keep working when international is switched off.
    expect(quoteShipping("US", 5000, closed).blocked).toBe(false);
    expect(quoteShipping("CA", 5000, closed).blocked).toBe(false);
  });

  describe("free shipping threshold", () => {
    const withThreshold = { ...settings, freeShippingThresholdCents: 5000 };

    it("does not apply below the threshold and reports the shortfall", () => {
      const quote = quoteShipping("US", 4999, withThreshold);
      expect(quote.shippingCents).toBe(500);
      expect(quote.freeShippingApplied).toBe(false);
      expect(quote.amountToFreeShippingCents).toBe(1);
    });

    it("applies exactly at the threshold", () => {
      const quote = quoteShipping("US", 5000, withThreshold);
      expect(quote.shippingCents).toBe(0);
      expect(quote.freeShippingApplied).toBe(true);
      expect(quote.amountToFreeShippingCents).toBe(0);
    });

    it("applies to international orders too", () => {
      expect(quoteShipping("DE", 6000, withThreshold).shippingCents).toBe(0);
    });

    it("reports no progress information when no threshold is configured", () => {
      expect(quoteShipping("US", 9999, settings).amountToFreeShippingCents).toBeNull();
    });
  });
});

describe("allowedCountriesForZone", () => {
  /**
   * The Stripe session is locked to the one country we quoted, otherwise a
   * customer could get a US rate quoted and then ship to Australia.
   */
  it("restricts the Stripe session to the quoted country", () => {
    expect(allowedCountriesForZone("de")).toEqual(["DE"]);
    expect(allowedCountriesForZone(" us ")).toEqual(["US"]);
  });
});

describe("baseRateForZone", () => {
  it("covers every zone", () => {
    expect(baseRateForZone("US", settings)).toBe(500);
    expect(baseRateForZone("CA", settings)).toBe(1500);
    expect(baseRateForZone("INTL", settings)).toBe(2500);
  });
});

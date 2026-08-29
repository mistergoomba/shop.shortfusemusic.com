/**
 * Every monetary value in this codebase is an integer number of cents.
 * There is no float currency math anywhere, on purpose. These helpers exist
 * so that the one place rounding happens is here.
 */

/** Format integer cents for display, e.g. 2000 -> "$20.00". */
export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Parse an admin-entered dollar string ("20", "20.5", "$20.00") into cents. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const asFloat = Number(cleaned);
  if (!Number.isFinite(asFloat)) return null;
  return Math.round(asFloat * 100);
}

/** Big Cartel exports prices as floats (15.0). Convert once, at import time. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

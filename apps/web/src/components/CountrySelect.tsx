"use client";

import { COUNTRIES } from "@/lib/countries";

/**
 * Destination country picker.
 *
 * Shipping is flat-rate by zone, but the zone depends on the country, and
 * Stripe Checkout only collects the address AFTER a session exists. So we ask
 * here, quote from it, and lock the Stripe session to the same country -- the
 * customer always sees the real shipping cost before they pay.
 */
export function CountrySelect({
  value,
  onChange,
  id = "destination-country",
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
}) {
  return (
    <>
      <label htmlFor={id} className="text-sm text-bone-dim">
        Ship to
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full border border-ink-line bg-ink-card px-3 py-2 text-bone"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </>
  );
}

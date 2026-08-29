"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

/**
 * Empties the local cart once the customer reaches a real, paid-or-pending
 * order page. Deliberately not done at hand-off to Stripe: if someone backs
 * out of the payment screen their cart must still be there.
 */
export function ClearCartOnMount() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}

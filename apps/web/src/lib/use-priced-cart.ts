"use client";

import { useEffect, useState } from "react";
import type { PricedCartResponse } from "@/lib/price-cart-server";
import { useCart } from "./cart-store";

/**
 * Keeps a server-priced view of the local cart.
 *
 * The local store renders instantly from its snapshot; this hook then asks the
 * server what the cart really costs and what it really qualifies for. Anything
 * the server reports -- a sold-out size, a discontinued offer -- overrides the
 * local snapshot in the UI.
 */
export function usePricedCart(countryCode: string | null) {
  const items = useCart((s) => s.items);
  const acceptedOfferId = useCart((s) => s.acceptedOfferId);
  const hydrated = useCart((s) => s.hydrated);

  const [cart, setCart] = useState<PricedCartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    fetch("/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        lines: items.map((i) => ({
          productId: i.productId,
          sizeId: i.sizeId,
          quantity: i.quantity,
        })),
        acceptedOfferId,
        countryCode,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: PricedCartResponse) => setCart(data))
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [items, acceptedOfferId, countryCode, hydrated]);

  return { cart, loading, failed, hydrated };
}

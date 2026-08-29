"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart-store";

/**
 * Cart indicator. Renders a zero count until the persisted cart has
 * rehydrated so the server-rendered markup and the first client paint agree.
 */
export function CartLink({ className = "" }: { className?: string }) {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const count = hydrated ? cartCount(items) : 0;

  return (
    <Link
      href="/cart"
      className={`stamp group flex items-center gap-2 text-sm text-bone transition-colors hover:text-blood-bright ${className}`}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <span>
        Cart <span aria-hidden="true">({count})</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6 fill-none stroke-blood stroke-2 transition-colors group-hover:stroke-blood-bright"
      >
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.55L21 8H6" />
        <circle cx="10" cy="20" r="1.4" className="fill-blood stroke-0" />
        <circle cx="18" cy="20" r="1.4" className="fill-blood stroke-0" />
      </svg>
    </Link>
  );
}

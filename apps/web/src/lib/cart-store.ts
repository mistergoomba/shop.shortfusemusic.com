"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Browser-side cart.
 *
 * The snapshot fields (name, price, image) exist ONLY so the cart renders
 * instantly without a round trip. They are display cache, never truth --
 * /api/cart re-prices every line from the database, and checkout recomputes
 * the whole order server-side before a Stripe session is created. A tampered
 * localStorage entry changes what the customer sees, never what they are
 * charged.
 */

export interface CartItem {
  productId: number;
  sizeId: number | null;
  quantity: number;
  /* --- display snapshot --- */
  name: string;
  slug: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  imageUrl: string | null;
}

/** Identity of a cart line is the product plus the chosen size. */
function keyOf(productId: number, sizeId: number | null): string {
  return `${productId}:${sizeId ?? "-"}`;
}

interface CartState {
  items: CartItem[];
  acceptedOfferId: number | null;
  /** Set once the store has rehydrated, to avoid a server/client mismatch. */
  hydrated: boolean;
  /**
   * The product whose "added to cart" confirmation is currently showing on its
   * own product page. Transient UI state, deliberately excluded from
   * `partialize` so it is never persisted -- coming back to the site tomorrow
   * should not greet you with a stale "added!" panel.
   */
  justAddedProductId: number | null;

  add: (item: CartItem) => void;
  remove: (productId: number, sizeId: number | null) => void;
  setQuantity: (productId: number, sizeId: number | null, quantity: number) => void;
  acceptOffer: (offerId: number) => void;
  clearOffer: () => void;
  clear: () => void;
  markHydrated: () => void;
  setJustAdded: (productId: number) => void;
  clearJustAdded: () => void;
}

const MAX_QTY = 99;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      acceptedOfferId: null,
      hydrated: false,
      justAddedProductId: null,

      add: (item) =>
        set((state) => {
          const key = keyOf(item.productId, item.sizeId);
          const existing = state.items.find(
            (i) => keyOf(i.productId, i.sizeId) === key,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                keyOf(i.productId, i.sizeId) === key
                  ? {
                      ...i,
                      ...item,
                      quantity: Math.min(MAX_QTY, i.quantity + item.quantity),
                    }
                  : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      remove: (productId, sizeId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => keyOf(i.productId, i.sizeId) !== keyOf(productId, sizeId),
          ),
        })),

      setQuantity: (productId, sizeId, quantity) =>
        set((state) => {
          if (quantity < 1) {
            return {
              items: state.items.filter(
                (i) => keyOf(i.productId, i.sizeId) !== keyOf(productId, sizeId),
              ),
            };
          }
          return {
            items: state.items.map((i) =>
              keyOf(i.productId, i.sizeId) === keyOf(productId, sizeId)
                ? { ...i, quantity: Math.min(MAX_QTY, quantity) }
                : i,
            ),
          };
        }),

      acceptOffer: (offerId) => set({ acceptedOfferId: offerId }),
      clearOffer: () => set({ acceptedOfferId: null }),
      clear: () => set({ items: [], acceptedOfferId: null, justAddedProductId: null }),
      markHydrated: () => set({ hydrated: true }),
      setJustAdded: (productId) => set({ justAddedProductId: productId }),
      clearJustAdded: () => set({ justAddedProductId: null }),
    }),
    {
      name: "shortfuse-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, acceptedOfferId: s.acceptedOfferId }),
      // Fires after localStorage is read. Until then components render the
      // empty cart so server and client markup agree on first paint.
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function cartSubtotalCents(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0);
}

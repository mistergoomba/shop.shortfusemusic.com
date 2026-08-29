"use client";

import { useState, useTransition } from "react";
import {
  reconcilePendingOrders,
  type OrderActionState,
} from "@/app/admin/(dash)/orders/actions";

/**
 * Recovers orders that Stripe charged but whose webhook never landed.
 *
 * Lives in admin rather than a CLI script deliberately: the person who needs
 * it is whoever notices a customer saying "I paid and nothing happened", and
 * that person should not need a terminal.
 */
export function ReconcileButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OrderActionState | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await reconcilePendingOrders());
          })
        }
        className="stamp min-h-11 border border-ink-line px-4 py-2 text-sm text-bone-dim transition-colors hover:text-bone disabled:opacity-50"
        title="Ask Stripe whether any pending order was actually paid"
      >
        {pending ? "Checking Stripe…" : "Reconcile with Stripe"}
      </button>

      {(result?.ok || result?.error) && (
        <p
          role="status"
          className={`max-w-md text-right text-sm ${
            result.error ? "text-blood-bright" : "text-bone-dim"
          }`}
        >
          {result.error ?? result.ok}
        </p>
      )}
    </div>
  );
}

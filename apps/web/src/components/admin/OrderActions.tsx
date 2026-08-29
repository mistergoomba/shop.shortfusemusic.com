"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { formatCents, type OrderStatus } from "@sf/shared";
import {
  cancelOrder,
  markShipped,
  refundOrder,
  updateOrderDetails,
  type OrderActionState,
} from "@/app/admin/(dash)/orders/actions";
import { Card, inputClass, labelClass } from "./ui";

interface OrderSummary {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  trackingNumber: string | null;
  internalNotes: string | null;
  totalCents: number;
  hasPaymentIntent: boolean;
}

function SaveDetails() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="stamp min-h-11 bg-blood px-5 py-2 text-sm text-bone hover:bg-blood-bright disabled:bg-ink-card disabled:text-bone-faint"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

/**
 * Every financial or irreversible action confirms first. The refund button in
 * particular states the exact amount, because it moves real money and cannot
 * be undone from this screen.
 */
function ConfirmAction({
  label,
  confirmLabel,
  question,
  tone = "ghost",
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  question: string;
  tone?: "ghost" | "danger";
  onConfirm: () => Promise<OrderActionState>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OrderActionState | null>(null);

  const base =
    tone === "danger"
      ? "border-blood text-blood-bright hover:bg-blood-deep/30"
      : "border-ink-line text-bone-dim hover:text-bone";

  if (result?.error) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-blood-bright">
          {result.error}
        </p>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setConfirming(false);
          }}
          className="min-h-11 text-sm text-bone-dim hover:text-bone"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <p role="status" className="text-sm text-bone-dim">
        {result.ok}
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`stamp min-h-11 border px-4 py-2 text-sm transition-colors ${base}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border border-blood px-4 py-2">
      <span className="text-sm text-bone">{question}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await onConfirm());
          })
        }
        className="stamp min-h-11 bg-blood px-4 text-sm text-bone hover:bg-blood-bright disabled:opacity-60"
      >
        {pending ? "Working…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 text-sm text-bone-dim hover:text-bone"
      >
        Cancel
      </button>
    </div>
  );
}

export function OrderActions({ order }: { order: OrderSummary }) {
  const [state, action] = useActionState<OrderActionState, FormData>(
    updateOrderDetails,
    {},
  );

  const canShip = order.status === "PAID";
  const canCancel = order.status === "PENDING";
  const canRefund =
    (order.status === "PAID" || order.status === "SHIPPED") && order.hasPaymentIntent;

  return (
    <Card title="Fulfilment">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={order.id} />

        <div>
          <label htmlFor="trackingNumber" className={labelClass}>
            Tracking number
          </label>
          <input
            id="trackingNumber"
            name="trackingNumber"
            defaultValue={order.trackingNumber ?? ""}
            placeholder="Shown to the customer on their order page"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="internalNotes" className={labelClass}>
            Internal notes{" "}
            <span className="text-bone-faint">(never shown to the customer)</span>
          </label>
          <textarea
            id="internalNotes"
            name="internalNotes"
            rows={3}
            defaultValue={order.internalNotes ?? ""}
            className={`${inputClass} min-h-20`}
          />
        </div>

        {(state.error || state.ok) && (
          <p
            role="status"
            className={`text-sm ${state.error ? "text-blood-bright" : "text-bone-dim"}`}
          >
            {state.error ?? state.ok}
          </p>
        )}

        <div>
          <SaveDetails />
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink-line pt-5">
        {canShip && (
          <ConfirmAction
            label="Mark as shipped"
            confirmLabel="Yes, it's shipped"
            question={`Mark ${order.orderNumber} as shipped?`}
            onConfirm={() => markShipped(order.id)}
          />
        )}

        {canCancel && (
          <ConfirmAction
            label="Cancel order"
            confirmLabel="Yes, cancel it"
            question={`Cancel ${order.orderNumber}? It has not been paid.`}
            onConfirm={() => cancelOrder(order.id)}
          />
        )}

        {canRefund && (
          <ConfirmAction
            label="Refund through Stripe"
            confirmLabel={`Refund ${formatCents(order.totalCents)}`}
            question={`Refund the full ${formatCents(order.totalCents)} for ${order.orderNumber}? This moves real money and can't be undone here.`}
            tone="danger"
            onConfirm={() => refundOrder(order.id)}
          />
        )}

        {!canShip && !canCancel && !canRefund && (
          <p className="text-sm text-bone-faint">
            No actions available for a {order.status.toLowerCase()} order.
          </p>
        )}
      </div>
    </Card>
  );
}

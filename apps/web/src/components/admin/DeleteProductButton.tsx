"use client";

import { useState } from "react";
import { deleteProduct } from "@/app/admin/(dash)/products/actions";

/**
 * Destructive action, so it asks first and requires the confirmation to be
 * deliberate rather than a stray double-click on a red button.
 */
export function DeleteProductButton({ id, name }: { id: number; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 border border-ink-line px-4 text-sm text-bone-faint hover:border-blood hover:text-blood-bright"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border border-blood px-4 py-2">
      <p className="text-sm text-bone">
        Delete <span className="text-blood-bright">{name}</span>? Past orders keep
        their records.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await deleteProduct(id);
        }}
        className="stamp min-h-11 bg-blood px-4 text-sm text-bone hover:bg-blood-bright disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 px-3 text-sm text-bone-dim hover:text-bone"
      >
        Cancel
      </button>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { OFFER_TRIGGER, formatCents, type OfferTrigger } from "@sf/shared";
import { deleteOffer, saveOffer, type OfferState } from "@/app/admin/(dash)/offers/actions";
import { Card, inputClass, labelClass } from "./ui";

interface OfferRow {
  id: number;
  name: string;
  productId: number;
  productName: string;
  offerPriceCents: number;
  active: boolean;
  triggerType: OfferTrigger;
  triggerProductId: number | null;
  triggerCategoryId: number | null;
  minimumSubtotalCents: number | null;
  sortPosition: number;
}

const TRIGGER_LABEL: Record<OfferTrigger, string> = {
  ALWAYS: "Always show",
  CONTAINS_PRODUCT: "Cart contains a specific product",
  CONTAINS_CATEGORY: "Cart contains anything from a category",
  MINIMUM_SUBTOTAL: "Cart subtotal reaches an amount",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="stamp min-h-11 bg-blood px-5 py-2 text-sm text-bone hover:bg-blood-bright disabled:bg-ink-card disabled:text-bone-faint"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function OfferForm({
  offer,
  productOptions,
  categories,
}: {
  offer?: OfferRow;
  productOptions: { id: number; name: string; active: boolean }[];
  categories: { id: number; name: string }[];
}) {
  const [state, action] = useActionState<OfferState, FormData>(saveOffer, {});
  const [trigger, setTrigger] = useState<OfferTrigger>(offer?.triggerType ?? "ALWAYS");
  const [confirming, setConfirming] = useState(false);
  const uid = offer ? String(offer.id) : "new";

  return (
    <Card title={offer ? offer.name : "Add an offer"}>
      <form action={action} className="flex flex-col gap-4">
        {offer && <input type="hidden" name="id" value={offer.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`o-name-${uid}`} className={labelClass}>
              Headline shown to customers
            </label>
            <input
              id={`o-name-${uid}`}
              name="name"
              defaultValue={offer?.name}
              placeholder="Add a sticker pack for $1"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor={`o-product-${uid}`} className={labelClass}>
              Product to offer
            </label>
            <select
              id={`o-product-${uid}`}
              name="productId"
              defaultValue={offer?.productId ?? ""}
              className={inputClass}
              required
            >
              <option value="">Choose a product…</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.active ? " (hidden)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`o-price-${uid}`} className={labelClass}>
              Offer price (USD)
            </label>
            <input
              id={`o-price-${uid}`}
              name="offerPrice"
              inputMode="decimal"
              defaultValue={
                offer ? (offer.offerPriceCents / 100).toFixed(2) : "1.00"
              }
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor={`o-sort-${uid}`} className={labelClass}>
              Sort position
            </label>
            <input
              id={`o-sort-${uid}`}
              name="sortPosition"
              type="number"
              defaultValue={offer?.sortPosition ?? 0}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={`o-trigger-${uid}`} className={labelClass}>
              Show this offer when
            </label>
            <select
              id={`o-trigger-${uid}`}
              name="triggerType"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as OfferTrigger)}
              className={inputClass}
            >
              {OFFER_TRIGGER.map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Only the field the chosen trigger uses is rendered. */}
          {trigger === "CONTAINS_PRODUCT" && (
            <div>
              <label htmlFor={`o-tp-${uid}`} className={labelClass}>
                Trigger product
              </label>
              <select
                id={`o-tp-${uid}`}
                name="triggerProductId"
                defaultValue={offer?.triggerProductId ?? ""}
                className={inputClass}
              >
                <option value="">Choose a product…</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {trigger === "CONTAINS_CATEGORY" && (
            <div>
              <label htmlFor={`o-tc-${uid}`} className={labelClass}>
                Trigger category
              </label>
              <select
                id={`o-tc-${uid}`}
                name="triggerCategoryId"
                defaultValue={offer?.triggerCategoryId ?? ""}
                className={inputClass}
              >
                <option value="">Choose a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {trigger === "MINIMUM_SUBTOTAL" && (
            <div>
              <label htmlFor={`o-min-${uid}`} className={labelClass}>
                Minimum subtotal (USD)
              </label>
              <input
                id={`o-min-${uid}`}
                name="minimumSubtotal"
                inputMode="decimal"
                defaultValue={
                  offer?.minimumSubtotalCents !== null &&
                  offer?.minimumSubtotalCents !== undefined
                    ? (offer.minimumSubtotalCents / 100).toFixed(2)
                    : "25.00"
                }
                className={inputClass}
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-bone">
            <input
              type="checkbox"
              name="active"
              defaultChecked={offer?.active ?? true}
              className="h-5 w-5 accent-[#c1121f]"
            />
            Active
          </label>

          <Submit label={offer ? "Save offer" : "Create offer"} />

          {offer &&
            (confirming ? (
              <span className="flex items-center gap-3">
                <span className="text-sm text-bone">Delete this offer?</span>
                <button
                  type="button"
                  onClick={() => deleteOffer(offer.id)}
                  className="stamp min-h-11 bg-blood px-4 text-sm text-bone hover:bg-blood-bright"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-11 text-sm text-bone-dim hover:text-bone"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-sm text-bone-faint underline underline-offset-4 hover:text-blood-bright"
              >
                Delete
              </button>
            ))}

          {offer && (
            <span className="text-sm text-bone-faint">
              Currently {formatCents(offer.offerPriceCents)} ·{" "}
              {offer.productName}
            </span>
          )}
        </div>

        {(state.error || state.ok) && (
          <p
            role="status"
            className={`text-sm ${state.error ? "text-blood-bright" : "text-bone-dim"}`}
          >
            {state.error ?? state.ok}
          </p>
        )}
      </form>
    </Card>
  );
}

export function OfferManager({
  offers,
  productOptions,
  categories,
}: {
  offers: OfferRow[];
  productOptions: { id: number; name: string; active: boolean }[];
  categories: { id: number; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {offers.map((o) => (
        <OfferForm
          key={o.id}
          offer={o}
          productOptions={productOptions}
          categories={categories}
        />
      ))}
      <OfferForm productOptions={productOptions} categories={categories} />
    </div>
  );
}

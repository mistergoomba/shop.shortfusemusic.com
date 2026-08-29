"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSettings, type SettingsState } from "@/app/admin/(dash)/settings/actions";
import { Card, inputClass, labelClass } from "./ui";

interface Initial {
  storeName: string;
  contactEmail: string;
  shippingUsCents: number;
  shippingCaCents: number;
  shippingIntlCents: number;
  internationalShippingEnabled: boolean;
  freeShippingThresholdCents: number | null;
  orderNotificationEmails: string | null;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="stamp min-h-11 bg-blood px-6 py-2.5 text-bone hover:bg-blood-bright disabled:bg-ink-card disabled:text-bone-faint"
    >
      {pending ? "Saving…" : "Save Settings"}
    </button>
  );
}

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveSettings, {});

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <Card title="Store">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="storeName" className={labelClass}>
              Store name
            </label>
            <input
              id="storeName"
              name="storeName"
              defaultValue={initial.storeName}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="contactEmail" className={labelClass}>
              Contact email <span className="text-bone-faint">(shown in the footer)</span>
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={initial.contactEmail}
              className={inputClass}
              required
            />
          </div>
        </div>
      </Card>

      <Card title="Order notifications">
        <p className="mb-4 text-sm text-bone-faint">
          Who gets emailed the moment an order is paid. One address per line, or
          separated by commas. Leave empty and it falls back to the contact
          email above.
        </p>
        <div>
          <label htmlFor="orderNotificationEmails" className={labelClass}>
            Notify these addresses
          </label>
          <textarea
            id="orderNotificationEmails"
            name="orderNotificationEmails"
            rows={3}
            defaultValue={initial.orderNotificationEmails ?? ""}
            placeholder={"info@shortfusemusic.com\nsomeone@example.com"}
            className={`${inputClass} min-h-20`}
          />
        </div>
      </Card>

      <Card title="Shipping">
        <p className="mb-4 text-sm text-bone-faint">
          Flat rates per destination zone. Anything that isn&rsquo;t the US or
          Canada uses the international rate.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="shippingUs" className={labelClass}>
              United States
            </label>
            <input
              id="shippingUs"
              name="shippingUs"
              inputMode="decimal"
              defaultValue={dollars(initial.shippingUsCents)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="shippingCa" className={labelClass}>
              Canada
            </label>
            <input
              id="shippingCa"
              name="shippingCa"
              inputMode="decimal"
              defaultValue={dollars(initial.shippingCaCents)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="shippingIntl" className={labelClass}>
              International
            </label>
            <input
              id="shippingIntl"
              name="shippingIntl"
              inputMode="decimal"
              defaultValue={dollars(initial.shippingIntlCents)}
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex items-center gap-3 text-sm text-bone">
            <input
              type="checkbox"
              name="internationalEnabled"
              defaultChecked={initial.internationalShippingEnabled}
              className="h-5 w-5 accent-[#c1121f]"
            />
            Accept orders outside the US and Canada
          </label>

          <div>
            <label htmlFor="freeShippingThreshold" className={labelClass}>
              Free shipping over{" "}
              <span className="text-bone-faint">(leave blank for none)</span>
            </label>
            <input
              id="freeShippingThreshold"
              name="freeShippingThreshold"
              inputMode="decimal"
              defaultValue={
                initial.freeShippingThresholdCents === null
                  ? ""
                  : dollars(initial.freeShippingThresholdCents)
              }
              placeholder="e.g. 50.00"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-bone-faint">
              Measured on the merchandise total after any cart-offer discount.
            </p>
          </div>
        </div>
      </Card>

      {(state.error || state.ok) && (
        <p
          role="status"
          className={`border px-4 py-3 text-sm ${
            state.error
              ? "border-blood text-blood-bright"
              : "border-ink-line text-bone-dim"
          }`}
        >
          {state.error ?? state.ok}
        </p>
      )}

      <div>
        <Submit />
      </div>
    </form>
  );
}

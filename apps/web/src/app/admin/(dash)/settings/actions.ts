"use server";

import { revalidatePath } from "next/cache";
import { getDb, storeSettings, eq } from "@sf/db";
import { storeSettingsInput } from "@sf/shared";
import { requireAdmin } from "@/lib/require-admin";

export interface SettingsState {
  error?: string;
  ok?: string;
}

function dollarsToCents(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const thresholdRaw = String(formData.get("freeShippingThreshold") ?? "").trim();

  const parsed = storeSettingsInput.safeParse({
    storeName: formData.get("storeName"),
    contactEmail: formData.get("contactEmail"),
    shippingUsCents: dollarsToCents(formData.get("shippingUs")),
    shippingCaCents: dollarsToCents(formData.get("shippingCa")),
    shippingIntlCents: dollarsToCents(formData.get("shippingIntl")),
    internationalShippingEnabled: formData.get("internationalEnabled") === "on",
    // Blank means "no free shipping offer", which is different from zero.
    freeShippingThresholdCents:
      thresholdRaw === "" ? null : dollarsToCents(thresholdRaw),
    orderNotificationEmails:
      String(formData.get("orderNotificationEmails") ?? "").trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  }

  const db = getDb();
  await db
    .update(storeSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(storeSettings.id, 1));

  // Shipping copy appears on the cart and checkout, and the contact email is
  // in the footer of every page.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");

  return { ok: "Settings saved." };
}

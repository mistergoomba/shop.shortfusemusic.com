"use server";

import { revalidatePath } from "next/cache";
import { getDb, cartOffers, eq } from "@sf/db";
import { cartOfferInput } from "@sf/shared";
import { requireAdmin } from "@/lib/require-admin";

export interface OfferState {
  error?: string;
  ok?: string;
}

function optionalNumber(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function saveOffer(
  _prev: OfferState,
  formData: FormData,
): Promise<OfferState> {
  await requireAdmin();

  const rawId = formData.get("id");
  const id = rawId ? Number(rawId) : null;

  const dollarsToCents = (v: FormDataEntryValue | null): number => {
    const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  };

  const minimum = optionalNumber(formData.get("minimumSubtotal"));

  const parsed = cartOfferInput.safeParse({
    name: formData.get("name"),
    productId: Number(formData.get("productId")),
    offerPriceCents: dollarsToCents(formData.get("offerPrice")),
    active: formData.get("active") === "on",
    triggerType: formData.get("triggerType"),
    triggerProductId: optionalNumber(formData.get("triggerProductId")),
    triggerCategoryId: optionalNumber(formData.get("triggerCategoryId")),
    minimumSubtotalCents: minimum === null ? null : Math.round(minimum * 100),
    sortPosition: Number(formData.get("sortPosition") ?? 0),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  }

  const db = getDb();

  // Only the field this trigger actually reads is stored; the others are
  // nulled so a trigger change cannot leave a stale condition behind.
  const data = {
    ...parsed.data,
    triggerProductId:
      parsed.data.triggerType === "CONTAINS_PRODUCT"
        ? parsed.data.triggerProductId
        : null,
    triggerCategoryId:
      parsed.data.triggerType === "CONTAINS_CATEGORY"
        ? parsed.data.triggerCategoryId
        : null,
    minimumSubtotalCents:
      parsed.data.triggerType === "MINIMUM_SUBTOTAL"
        ? parsed.data.minimumSubtotalCents
        : null,
    updatedAt: new Date(),
  };

  if (id) {
    await db.update(cartOffers).set(data).where(eq(cartOffers.id, id));
  } else {
    await db.insert(cartOffers).values(data);
  }

  revalidatePath("/admin/offers");
  revalidatePath("/cart");
  return { ok: id ? "Offer saved." : "Offer created." };
}

export async function deleteOffer(id: number): Promise<void> {
  await requireAdmin();
  const db = getDb();
  await db.delete(cartOffers).where(eq(cartOffers.id, id));
  revalidatePath("/admin/offers");
  revalidatePath("/cart");
}

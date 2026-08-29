"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getDb,
  products,
  productSizes,
  productImages,
  relatedProducts,
  eq,
  and,
  inArray,
  notInArray,
} from "@sf/db";
import { productInput, sizeSortPosition } from "@sf/shared";
import { sanitizeDescription } from "@sf/core";
import { requireAdmin } from "@/lib/require-admin";

export interface SaveState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Storefront pages are statically generated with a 5-minute revalidate, so an
 * admin edit must explicitly bust the paths it affects -- otherwise the band
 * changes a price and does not see it for five minutes and assumes it broke.
 */
function revalidateStorefront(slug?: string) {
  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/product/[slug]", "page");
  if (slug) revalidatePath(`/product/${slug}`);
}

export async function saveProduct(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireAdmin();

  const rawId = formData.get("id");
  const id = rawId ? Number(rawId) : null;

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "The form data was malformed. Try again." };
  }

  const parsed = productInput.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const input = parsed.data;
  const db = getDb();

  // Slugs are the product's public URL, so a collision must be a clear error
  // rather than a database constraint blowing up in the user's face.
  const clash = await db.query.products.findFirst({
    where: eq(products.slug, input.slug),
    columns: { id: true },
  });
  if (clash && clash.id !== id) {
    return {
      error: "Another product already uses that slug.",
      fieldErrors: { slug: "Already taken" },
    };
  }

  const values = {
    name: input.name,
    slug: input.slug,
    // Sanitized on the way in as well as on the way out.
    description: input.description ? sanitizeDescription(input.description) : null,
    priceCents: input.priceCents,
    salePriceCents: input.salePriceCents,
    categoryId: input.categoryId,
    availability: input.availability,
    featured: input.featured,
    active: input.active,
    sortPosition: input.sortPosition,
    updatedAt: new Date(),
  };

  let productId: number;

  if (id) {
    await db.update(products).set(values).where(eq(products.id, id));
    productId = id;
  } else {
    const [row] = await db
      .insert(products)
      .values(values)
      .returning({ id: products.id });
    productId = row!.id;
  }

  /* ---- Sizes ---- */
  const keptSizeIds: number[] = [];
  for (const [index, size] of input.sizes.entries()) {
    const sortPosition = sizeSortPosition(size.label) || index;
    if (size.id) {
      await db
        .update(productSizes)
        .set({ label: size.label, availability: size.availability, sortPosition })
        .where(
          and(eq(productSizes.id, size.id), eq(productSizes.productId, productId)),
        );
      keptSizeIds.push(size.id);
    } else {
      const [row] = await db
        .insert(productSizes)
        .values({
          productId,
          label: size.label,
          availability: size.availability,
          sortPosition,
        })
        .onConflictDoUpdate({
          target: [productSizes.productId, productSizes.label],
          set: { availability: size.availability, sortPosition },
        })
        .returning({ id: productSizes.id });
      if (row) keptSizeIds.push(row.id);
    }
  }
  // Remove sizes the admin deleted. Order history is unaffected: order_items
  // store the size label as a snapshot, not a foreign key.
  await db
    .delete(productSizes)
    .where(
      keptSizeIds.length > 0
        ? and(
            eq(productSizes.productId, productId),
            notInArray(productSizes.id, keptSizeIds),
          )
        : eq(productSizes.productId, productId),
    );

  /* ---- Images ---- */
  const keptImageIds: number[] = [];
  for (const [index, image] of input.images.entries()) {
    if (image.id) {
      await db
        .update(productImages)
        .set({ url: image.url, alt: image.alt, sortPosition: index })
        .where(
          and(eq(productImages.id, image.id), eq(productImages.productId, productId)),
        );
      keptImageIds.push(image.id);
    } else {
      const [row] = await db
        .insert(productImages)
        .values({
          productId,
          url: image.url,
          alt: image.alt,
          width: image.width,
          height: image.height,
          sortPosition: index,
        })
        .returning({ id: productImages.id });
      if (row) keptImageIds.push(row.id);
    }
  }
  await db
    .delete(productImages)
    .where(
      keptImageIds.length > 0
        ? and(
            eq(productImages.productId, productId),
            notInArray(productImages.id, keptImageIds),
          )
        : eq(productImages.productId, productId),
    );

  /* ---- Related products ---- */
  await db.delete(relatedProducts).where(eq(relatedProducts.productId, productId));
  const relatedIds = input.relatedProductIds.filter((rid) => rid !== productId);
  if (relatedIds.length > 0) {
    await db
      .insert(relatedProducts)
      .values(
        relatedIds.map((relatedProductId, sortPosition) => ({
          productId,
          relatedProductId,
          sortPosition,
        })),
      )
      .onConflictDoNothing();
  }

  revalidateStorefront(input.slug);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);

  redirect(`/admin/products/${productId}?saved=1`);
}

export async function toggleProductActive(id: number, active: boolean) {
  await requireAdmin();
  const db = getDb();
  await db
    .update(products)
    .set({ active, updatedAt: new Date() })
    .where(eq(products.id, id));
  revalidateStorefront();
  revalidatePath("/admin/products");
}

export async function toggleProductFeatured(id: number, featured: boolean) {
  await requireAdmin();
  const db = getDb();
  await db
    .update(products)
    .set({ featured, updatedAt: new Date() })
    .where(eq(products.id, id));
  revalidateStorefront();
  revalidatePath("/admin/products");
}

export async function deleteProduct(id: number) {
  await requireAdmin();
  const db = getDb();
  // order_items.product_id is ON DELETE SET NULL and every item carries a name
  // and price snapshot, so deleting a product never damages order history.
  await db.delete(products).where(eq(products.id, id));
  revalidateStorefront();
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

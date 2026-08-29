"use server";

import { revalidatePath } from "next/cache";
import { getDb, categories, products, eq, count } from "@sf/db";
import { categoryInput } from "@sf/shared";
import { requireAdmin } from "@/lib/require-admin";

export interface CategoryState {
  error?: string;
  ok?: string;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/admin/categories");
}

export async function saveCategory(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  await requireAdmin();

  const rawId = formData.get("id");
  const id = rawId ? Number(rawId) : null;

  const parsed = categoryInput.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sortPosition: Number(formData.get("sortPosition") ?? 0),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  }

  const db = getDb();

  const clash = await db.query.categories.findFirst({
    where: eq(categories.slug, parsed.data.slug),
    columns: { id: true },
  });
  if (clash && clash.id !== id) {
    return { error: "Another category already uses that slug." };
  }

  if (id) {
    await db
      .update(categories)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(categories.id, id));
  } else {
    await db.insert(categories).values(parsed.data);
  }

  revalidateAll();
  return { ok: id ? "Category updated." : "Category created." };
}

export async function deleteCategory(id: number): Promise<CategoryState> {
  await requireAdmin();
  const db = getDb();

  // Products survive: categoryId is ON DELETE SET NULL. Say so plainly rather
  // than silently orphaning half the catalog.
  const [row] = await db
    .select({ n: count() })
    .from(products)
    .where(eq(products.categoryId, id));

  await db.delete(categories).where(eq(categories.id, id));
  revalidateAll();

  const n = row?.n ?? 0;
  return {
    ok:
      n > 0
        ? `Category deleted. ${n} ${n === 1 ? "product is" : "products are"} now uncategorised.`
        : "Category deleted.",
  };
}

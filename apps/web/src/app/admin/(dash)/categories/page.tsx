import { listCategories } from "@/lib/admin-data";
import { PageHeading } from "@/components/admin/ui";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <>
      <PageHeading>Categories</PageHeading>
      <p className="mb-6 max-w-prose text-sm text-bone-faint">
        These drive the shop navigation and the category pages. The slug is the
        public URL, so changing it breaks any existing link to that category.
      </p>
      <CategoryManager categories={categories} />
    </>
  );
}

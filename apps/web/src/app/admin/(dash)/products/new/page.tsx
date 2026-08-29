import { listCategories, listProductOptions } from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeading } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const [categories, productOptions] = await Promise.all([
    listCategories(),
    listProductOptions(),
  ]);

  return (
    <>
      <PageHeading>New product</PageHeading>
      <ProductForm
        categories={categories}
        productOptions={productOptions}
        initial={{
          name: "",
          slug: "",
          description: null,
          priceCents: 0,
          salePriceCents: null,
          categoryId: null,
          availability: "IN_STOCK",
          featured: false,
          active: true,
          sortPosition: 0,
          sizes: [],
          images: [],
          relatedProductIds: [],
        }}
      />
    </>
  );
}

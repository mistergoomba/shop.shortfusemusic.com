import { notFound } from "next/navigation";
import {
  getProductForEdit,
  listCategories,
  listProductOptions,
} from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeading } from "@/components/admin/ui";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const [product, categories, productOptions] = await Promise.all([
    getProductForEdit(productId),
    listCategories(),
    listProductOptions(),
  ]);

  if (!product) notFound();

  return (
    <>
      <PageHeading action={<DeleteProductButton id={product.id} name={product.name} />}>
        {product.name}
      </PageHeading>

      {saved && (
        <p
          role="status"
          className="mb-6 border border-blood bg-blood/15 px-4 py-3 text-sm text-bone"
        >
          Saved. The storefront has been refreshed.
        </p>
      )}

      <ProductForm
        categories={categories}
        productOptions={productOptions}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          priceCents: product.priceCents,
          salePriceCents: product.salePriceCents,
          categoryId: product.categoryId,
          availability: product.availability,
          featured: product.featured,
          active: product.active,
          sortPosition: product.sortPosition,
          sizes: product.sizes.map((s) => ({
            id: s.id,
            label: s.label,
            availability: s.availability,
          })),
          images: product.images.map((i) => ({
            id: i.id,
            url: i.url,
            alt: i.alt,
            width: i.width,
            height: i.height,
          })),
          relatedProductIds: product.related.map((r) => r.id),
        }}
      />
    </>
  );
}

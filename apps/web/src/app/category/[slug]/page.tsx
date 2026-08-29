import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCategories,
  getCategoryBySlug,
  getProductsByCategory,
} from "@/lib/catalog";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";

export const revalidate = 300;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Not found" };

  return {
    title: category.name,
    description: `${category.name} — official Short Fuse merchandise.`,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: `${category.name} | Short Fuse`,
      description: `${category.name} — official Short Fuse merchandise.`,
      url: `/category/${category.slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
  ]);

  if (!category) notFound();

  const products = await getProductsByCategory(category.id);

  return (
    <div className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 lg:px-8 lg:py-8">
      <CategorySidebar categories={categories} activeSlug={category.slug} />

      <div className="min-w-0 flex-1">
        <SectionHeading as="h1">{category.name}</SectionHeading>
        <p className="mb-6 -mt-4 text-sm text-bone-faint">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
        <ProductGrid products={products} priorityCount={4} />
      </div>
    </div>
  );
}

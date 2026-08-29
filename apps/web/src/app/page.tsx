import { getAllProducts, getCategories, getFeaturedProducts } from "@/lib/catalog";
import { CategorySidebar } from "@/components/CategorySidebar";
import { Hero } from "@/components/Hero";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";

export const revalidate = 300;

export default async function HomePage() {
  const [categories, featured, all] = await Promise.all([
    getCategories(),
    getFeaturedProducts(4),
    getAllProducts(),
  ]);

  // The whole catalog is on the homepage, but broken into category sections
  // rather than one undifferentiated wall of 30 products. Grouping in memory
  // because the catalog is small and this avoids a query per category.
  const byCategory = new Map<number, typeof all>();
  const uncategorised: typeof all = [];

  for (const product of all) {
    if (product.categoryId === null) {
      uncategorised.push(product);
      continue;
    }
    const bucket = byCategory.get(product.categoryId);
    if (bucket) bucket.push(product);
    else byCategory.set(product.categoryId, [product]);
  }

  // Category order comes from the database, so the admin's sort position
  // drives the homepage as well as the nav. Empty categories are skipped.
  const sections = categories
    .map((category) => ({ category, products: byCategory.get(category.id) ?? [] }))
    .filter((section) => section.products.length > 0);

  return (
    <div className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 lg:px-8 lg:py-8">
      <CategorySidebar categories={categories} />

      <div className="min-w-0 flex-1">
        <Hero />

        {featured.length > 0 && (
          <section className="mt-10" aria-labelledby="featured-heading">
            <SectionHeading href="#catalog" linkLabel="View All">
              <span id="featured-heading">Featured</span>
            </SectionHeading>
            <ProductGrid products={featured} priorityCount={4} />
          </section>
        )}

        <div id="catalog" className="scroll-mt-8">
          {sections.map(({ category, products }) => (
            <section
              key={category.id}
              className="mt-14"
              aria-labelledby={`cat-${category.slug}`}
            >
              <SectionHeading
                href={`/category/${category.slug}`}
                linkLabel={`All ${category.name}`}
              >
                <span id={`cat-${category.slug}`}>{category.name}</span>
              </SectionHeading>
              <ProductGrid products={products} />
            </section>
          ))}

          {uncategorised.length > 0 && (
            <section className="mt-14" aria-labelledby="cat-everything-else">
              <SectionHeading>
                <span id="cat-everything-else">Everything Else</span>
              </SectionHeading>
              <ProductGrid products={uncategorised} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

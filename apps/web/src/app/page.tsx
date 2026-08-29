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

  return (
    <div className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 lg:px-8 lg:py-8">
      <CategorySidebar categories={categories} />

      <div className="min-w-0 flex-1">
        <Hero />

        {featured.length > 0 && (
          <section className="mt-10" aria-labelledby="featured-heading">
            <SectionHeading href="/#everything" linkLabel="View All">
              <span id="featured-heading">Featured</span>
            </SectionHeading>
            <ProductGrid products={featured} priorityCount={4} />
          </section>
        )}

        <section className="mt-14 scroll-mt-8" id="everything" aria-labelledby="all-heading">
          <SectionHeading>
            <span id="all-heading">Everything We&rsquo;ve Got</span>
          </SectionHeading>
          <ProductGrid products={all} />
        </section>
      </div>
    </div>
  );
}

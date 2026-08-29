import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { descriptionToPlainText, sanitizeDescription, truncate } from "@sf/core";
import { formatCents } from "@sf/shared";
import {
  getAllProducts,
  getProductBySlug,
  getRelatedProducts,
  isProductBuyable,
} from "@/lib/catalog";
import { AddToCart } from "@/components/AddToCart";
import { Price } from "@/components/Price";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";
import {
  ProductDetailsSlot,
  RelatedSlot,
} from "@/components/ProductDetailsSlot";

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };

  const summary =
    truncate(descriptionToPlainText(product.description), 160) ||
    `${product.name} — official Short Fuse merchandise.`;
  const image = product.images[0];

  return {
    title: product.name,
    description: summary,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} | Short Fuse`,
      description: summary,
      url: `/product/${product.slug}`,
      images: image ? [{ url: image.url, alt: image.alt ?? product.name }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  // Sanitized at import and again here: the database is not a trust boundary.
  const description = sanitizeDescription(product.description);
  const buyable = isProductBuyable(product);

  const effectivePrice =
    product.salePriceCents !== null && product.salePriceCents < product.priceCents
      ? product.salePriceCents
      : product.priceCents;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: truncate(descriptionToPlainText(product.description), 400),
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: "Short Fuse" },
    offers: {
      "@type": "Offer",
      price: (effectivePrice / 100).toFixed(2),
      priceCurrency: "USD",
      availability: buyable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-bone-faint">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-blood-bright">
              Shop
            </Link>
          </li>
          {product.categorySlug && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/category/${product.categorySlug}`}
                  className="hover:text-blood-bright"
                >
                  {product.categoryName}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li className="text-bone-dim">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl leading-tight text-bone sm:text-4xl">
              {product.name}
            </h1>
            {product.categoryName && (
              <p className="stamp mt-1.5 text-sm text-bone-faint">
                {product.categoryName}
              </p>
            )}
          </div>

          <Price
            priceCents={product.priceCents}
            salePriceCents={product.salePriceCents}
            size="lg"
          />

          <AddToCart product={product} />

          {/* Shows the description normally; swaps to the "added to cart"
              confirmation, the two next-step buttons, and the suggestions once
              the item is in the cart. The suggestions are passed in already
              rendered because ProductGrid reaches into server-only catalog
              helpers and cannot itself be a client component. */}
          <ProductDetailsSlot
            productId={product.id}
            productName={product.name}
            categoryHref={
              product.categorySlug ? `/category/${product.categorySlug}` : "/"
            }
            related={
              related.length > 0 ? (
                <section className="mt-8" aria-labelledby="related-inline">
                  <h2
                    id="related-inline"
                    className="rule-blood mb-6 text-xl text-bone"
                  >
                    You Might Also Dig
                  </h2>
                  <ProductGrid products={related} compact />
                </section>
              ) : null
            }
            description={
              description ? (
                <div className="border-t border-ink-line pt-6">
                  <h2 className="mb-3 text-lg text-bone">Details</h2>
                  <div
                    className="prose-sf text-sm"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                </div>
              ) : null
            }
          />

          <p className="text-xs text-bone-faint">
            Flat-rate shipping calculated at checkout. Ships worldwide.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <RelatedSlot productId={product.id}>
          <section className="mt-16" aria-labelledby="related-heading">
            <SectionHeading>
              <span id="related-heading">You Might Also Dig</span>
            </SectionHeading>
            <ProductGrid products={related} />
          </section>
        </RelatedSlot>
      )}
    </div>
  );
}

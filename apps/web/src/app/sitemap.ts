import type { MetadataRoute } from "next";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { env } from "@/lib/env";

export const revalidate = 3600;

/**
 * Only public, indexable pages. Cart, checkout, order confirmations and the
 * whole admin are deliberately absent -- they are also marked noindex.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  const [categories, products] = await Promise.all([
    getCategories(),
    getAllProducts(),
  ]);

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...categories.map((c) => ({
      url: `${base}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: (p as { updatedAt?: Date }).updatedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}

import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is secret -- the admin is password gated and order pages
      // need an unguessable token -- but none of it belongs in an index.
      disallow: ["/admin", "/admin/", "/cart", "/checkout", "/order/", "/api/"],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}

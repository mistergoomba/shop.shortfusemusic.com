import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Next only reads .env from the app directory, but this is a monorepo with a
// single root .env shared by the app, the migrations and the importer. Load it
// here so `next dev` and `next build` see the same values as `pnpm db:migrate`.
// In production Vercel injects real env vars and this file simply finds nothing.
loadEnv({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  // Workspace packages ship as TypeScript source with no build step, so Next
  // compiles them itself. Keeps `pnpm dev` to a single process.
  transpilePackages: ["@sf/core", "@sf/db", "@sf/shared"],

  images: {
    remotePatterns: [
      // Big Cartel originals, used until the mirror step has run.
      { protocol: "https", hostname: "assets.bigcartel.com" },
      // Vercel Blob, where mirrored images live.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // Server Actions keep their 1MB default body limit: the admin submits JSON
  // (a product description caps at 20k characters), never file uploads, and
  // the default same-origin restriction is exactly the CSRF posture we want.

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

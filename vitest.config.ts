import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@sf/shared": resolve(import.meta.dirname, "packages/shared/src/index.ts"),
      "@sf/core": resolve(import.meta.dirname, "packages/core/src/index.ts"),
      "@sf/db": resolve(import.meta.dirname, "packages/db/src/index.ts"),
    },
  },
});

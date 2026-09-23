import type { NextConfig } from "next";

const config: NextConfig = {
  // The workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them alongside the app.
  transpilePackages: ["@comlabs/cms-core", "@comlabs/cms-db"],
  // Prisma must not be bundled — it loads a native query engine at runtime.
  serverExternalPackages: ["@prisma/client", "prisma"],
  eslint: { ignoreDuringBuilds: true },
};

export default config;

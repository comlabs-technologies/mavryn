import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(appDir, "..", "..");

const config: NextConfig = {
  // The workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them alongside the app.
  transpilePackages: ["@comlabs/cms-core", "@comlabs/cms-db"],

  // Prisma must not be bundled — it loads a native query engine at runtime.
  serverExternalPackages: ["@prisma/client", "prisma"],

  // Trace from the monorepo root so the workspace packages are followed.
  outputFileTracingRoot: repoRoot,

  // Marking @prisma/client external takes it out of the bundle, and nothing
  // then points the file tracer at the generated client or its native engine,
  // so a standalone build ships without them and dies on the first query.
  // Pull them in explicitly.
  outputFileTracingIncludes: {
    "**": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/**",
    ],
  },

  eslint: { ignoreDuringBuilds: true },

  // Emits .next/standalone with a self-contained server.js — what the
  // Docker image runs, so the runtime stage needs no node_modules install.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default config;

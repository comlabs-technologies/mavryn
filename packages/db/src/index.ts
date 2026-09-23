import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";
export { PrismaClient };

declare global {
  // Reused across hot reloads in development so we do not exhaust connections.
  // eslint-disable-next-line no-var
  var __comlabsCmsPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Comlabs CMS requires PostgreSQL — copy .env.example to .env and point it at your database.",
    );
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient =
  globalThis.__comlabsCmsPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__comlabsCmsPrisma = prisma;
}

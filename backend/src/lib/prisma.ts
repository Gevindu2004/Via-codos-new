import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  backendPrisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.backendPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.backendPrisma = prisma;
}


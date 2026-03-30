// Prisma v6 uses the standard output location
import { PrismaClient } from "@prisma/client";

// Prevent creating a new PrismaClient on every hot-reload in dev.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;


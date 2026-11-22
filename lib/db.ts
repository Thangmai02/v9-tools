import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ quiet: true });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

void prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

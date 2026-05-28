import { PrismaClient } from "@prisma/client";

const localDevelopmentDatabaseUrl =
  "mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test";

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  process.env.DATABASE_URL = localDevelopmentDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

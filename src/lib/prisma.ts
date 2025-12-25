import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { parse } from "pg-connection-string"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  pool?: Pool
}

const databaseUrl = process.env.DATABASE_URL ?? ""
const poolConfig = databaseUrl ? parse(databaseUrl) : {}
const pool =
  globalForPrisma.pool ??
  new Pool({
    ...poolConfig,
    ssl: { rejectUnauthorized: false },
  })

const needsRefresh =
  !globalForPrisma.prisma || !("photo" in globalForPrisma.prisma)

const prismaClient = needsRefresh
  ? new PrismaClient({
      adapter: new PrismaPg(pool),
    })
  : globalForPrisma.prisma

export const prisma = prismaClient

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.pool = pool
}

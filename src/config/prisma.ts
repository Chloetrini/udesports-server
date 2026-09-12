import 'dotenv/config'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import logger, { logError } from './logger.js'
import { env } from './key.js'

const isDev = env.NODE_ENV === 'development'

// Reuse a single client + pool across hot-reloads in dev, AND across warm
// invocations of the same serverless function (Vercel) in production — a
// long-running server only ever loads this module once anyway, so caching
// here is free there, but on Vercel each cold start would otherwise open a
// brand new pool of up to `max` connections with no way to close the old
// one, exhausting the database's connection limit under real traffic.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  pool?: Pool
}

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20, //pool size lives here, not in Prisma
  })

//log pool-level errors (dropped connections are handled by the pool itself)
pool.on('error', err => logError(err, 'pg pool error'))

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: isDev ? ['query', 'error', 'warn'] : ['error'],
  })

globalForPrisma.prisma = prisma
globalForPrisma.pool = pool

export {  pool }
export default prisma

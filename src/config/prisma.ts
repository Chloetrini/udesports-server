import 'dotenv/config'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import logger, { logError } from './logger.js'
import { env } from './key.js'

const isDev = env.NODE_ENV === 'development'

//reuse a single client + pool across hot-reloads in dev to avoid exhausting connections
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

if (isDev) {
  globalForPrisma.prisma = prisma
  globalForPrisma.pool = pool
}

export {  pool }
export default prisma
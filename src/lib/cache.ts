import type { Request } from 'express'
import logger from '../config/logger.js'

// In-process cache. This used to talk to a MemCachier server in us-west-2
// from a function running in us-east-1: every request paid for two remote
// round trips (namespace version + value) and they were timing out, so the
// cache never hit (x-cache was always MISS) and made every API call slower.
// A per-instance Map costs nothing; cross-instance freshness is handled by
// short TTLs plus the CDN headers set in cache.middleware.ts.
const CACHE_PREFIX = 'ude:v1'
const DEFAULT_TTL = 60 // 60 seconds
const MAX_ENTRIES = 500

const store = new Map<string, { value: string; expiresAt: number }>()
const versions = new Map<string, number>()

/**
 * Build a consistent cache key from the request.
 */
export const generateCacheKey = (req: Request, suffix?: string): string => {
  const base = `${CACHE_PREFIX}:${req.baseUrl}${req.path}`
  if (suffix) return `${base}:${suffix}`
  if (Object.keys(req.query).length > 0) {
    const sorted = new URLSearchParams(
      Object.entries(req.query)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return `${base}:${sorted}`
  }
  return base
}

/**
 * Get a value from cache. Returns null on miss or expiry (never throws).
 */
export const getCache = async (key: string): Promise<string | null> => {
  const hit = store.get(key)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    store.delete(key)
    return null
  }
  logger.debug({ cacheKey: key }, 'Cache HIT')
  return hit.value
}

/**
 * Set a value in cache with a TTL in seconds.
 */
export const setCache = async (key: string, value: string, ttl: number = DEFAULT_TTL): Promise<boolean> => {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
  return true
}

/**
 * Delete a single cache key.
 */
export const deleteCache = async (key: string): Promise<boolean> => store.delete(key)

/**
 * Flush the entire cache.
 */
export const flushCache = async (): Promise<boolean> => {
  store.clear()
  return true
}

// Each resource namespace carries a version baked into every cache key.
// Bumping it orphans all old keys at once; they age out on their own TTL.
export const getNamespaceVersion = async (namespace: string): Promise<number> =>
  versions.get(namespace) ?? 1

export const bumpNamespaceVersion = async (namespace: string): Promise<void> => {
  versions.set(namespace, (versions.get(namespace) ?? 1) + 1)
}

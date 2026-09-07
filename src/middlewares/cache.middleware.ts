import type { NextFunction, Request, Response } from 'express'
import { bumpNamespaceVersion, generateCacheKey, getCache, getNamespaceVersion, setCache } from '../lib/cache.js'

/**
 * Cache middleware — caches GET responses, keyed by namespace version.
 * Usage: router.get('/', cacheMiddleware('players', 60), controller)
 *
 * The namespace version is baked into the key, so bumping that version
 * (via invalidateCache) instantly orphans every cached entry for the resource.
 */
export const cacheMiddleware = (namespace: string, durationSeconds: number = 60) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next()
      return
    }

    const version = await getNamespaceVersion(namespace)
    const key = `${generateCacheKey(req)}:v${version}`

    // Try cache
    const cached = await getCache(key)
    if (cached !== null) {
      res.setHeader('x-cache', 'HIT')
      res.status(200).json(JSON.parse(cached))
      return
    }

    // Override res.json to capture the response body for caching
    const originalJson = res.json.bind(res)
    res.json = function (body: any): Response {
      setCache(key, JSON.stringify(body), durationSeconds) // fire and forget
      res.setHeader('x-cache', 'MISS')
      return originalJson(body)
    }

    next()
  }
}

/**
 * Invalidate an entire resource namespace after a mutation.
 * Usage: router.post('/', invalidateCache('players'), controller)
 *
 * Bumps the namespace version so all previously cached keys for that
 * resource are orphaned at once (they expire on their own TTL).
 */
export const invalidateCache = (namespace: string) => {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await bumpNamespaceVersion(namespace)
    next()
  }
}
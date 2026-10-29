import type { NextFunction, Request, Response } from 'express'
import { bumpNamespaceVersion } from '../lib/cache.js'

/**
 * Cache middleware — caches GET responses, keyed by namespace version.
 * Usage: router.get('/', cacheMiddleware('players', 60), controller)
 *
 * The namespace version is baked into the key, so bumping that version
 * (via invalidateCache) instantly orphans every cached entry for the resource.
 */
export const cacheMiddleware = (_namespace: string, durationSeconds: number = 60) => {
  // Freshness matters more than a long cache: admins expect an edit or delete
  // to show on the public site almost immediately. Each serverless instance
  // used to keep its own in-memory copy (a write on one instance never cleared
  // the others) and the edge could serve stale copies for minutes. Now only
  // Vercel's shared edge cache holds a response, for a short fixed window, so
  // a change is live within ~15s everywhere.
  const edgeSeconds = Math.min(durationSeconds, 15)
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${edgeSeconds}`)
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
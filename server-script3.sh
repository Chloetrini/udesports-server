#!/usr/bin/env bash
set -euo pipefail
echo "Applying UDESPORT backend hotfix: stop pino-pretty from crashing every request on Vercel..."

mkdir -p "$(dirname "src/config/logger.ts")"
cat > "src/config/logger.ts" << 'UDESFIX_01_EOF'
import pino, { type Logger } from 'pino'
import { env } from './key.js'

const isDev = env.NODE_ENV === 'development'

// pino's `transport` option spawns pino-pretty in a worker thread, which
// needs to resolve pino-pretty as a real file on disk at runtime. Vercel
// (and any bundler-based serverless build) packs everything into a single
// bundled function file, so that resolution fails there even when isDev is
// somehow true (e.g. NODE_ENV misconfigured) — crashing the ENTIRE app on
// every request with "unable to determine transport target for pino-pretty".
// `process.env.VERCEL` is set automatically on every Vercel deployment, so
// this keeps the crash from ever happening there regardless of NODE_ENV.
const usePrettyTransport = isDev && !process.env.VERCEL

const logger: Logger = pino({
  level: env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: {
    pid: process.pid,
    env: env.NODE_ENV,
  },
  transport: usePrettyTransport
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
        },
      }
    : undefined,
})

//helper functions to log errors with context
export const logError = (error: Error | unknown, context?: string, metadata?: Record<string, unknown>): void => {
  const errorInfo =
    error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { message: String(error) }

  logger.error(
    {
      err: errorInfo,
      context,
      ...metadata,
    },
    context || 'An error occured'
  )
}

//helper function to log http request
export const logRequest = (
  req: {
    method: string
    url: string
    ip?: string
    userId?: string
  },
  metadata?: Record<string, unknown>
): void => {
  logger.info(
    {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.userId,
      ...metadata,
    },
    `${req.method} ${req.url}`
  )
}

export default logger
UDESFIX_01_EOF
echo "  wrote src/config/logger.ts"

echo ""
echo "Done. Next steps:"
echo "  1. npx tsc --noEmit"
echo "  2. git add -A && git commit -m \"fix: stop pino-pretty transport from crashing on Vercel\" && git push"
echo "  3. Also double-check NODE_ENV=production is actually set in Vercel Settings -> Environment Variables -- this fix stops the crash either way, but NODE_ENV being wrong still affects other things (log verbosity, cookie secure flag)."

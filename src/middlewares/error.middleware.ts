import { randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'
import pinoHttpModule from 'pino-http'
import { Prisma } from '../../generated/prisma/client'
import { env } from '../config/key.js'
import logger from '../config/logger.js'
import { sendTsRestError } from '../lib/responseHandler.js'

const pinoHttp = (pinoHttpModule as any).default || pinoHttpModule

const isDev = env.NODE_ENV === 'development'

class ErrorResponse extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    Error.captureStackTrace(this, this.constructor)
  }
}

// Express middleware factory for request logging
export const createExpressLogger = () => {
  return pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          host: req.headers.host,
        },
        remoteAddress: req.raw.socket?.remoteAddress,
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
      }),
    },
    autoLogging: !isDev ? { ignore: (req: any) => req.url === '/api/health' } : true,
  })
}

// Global unhandled error handlers
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', error => {
    logger.fatal({ err: error }, 'Uncaught Exception')
    setTimeout(() => process.exit(1), 1000)
  })

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection')
  })
}

export const appErrorHandler = (err: Error | ErrorResponse, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err } as ErrorResponse
  error.message = err.message

  logger.error(err)

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      error = new ErrorResponse('Resource not found', 404)
    }
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') ?? 'field'
      error = new ErrorResponse(`Duplicate value for ${target}`, 400)
    }
    if (err.code === 'P2003') {
      error = new ErrorResponse('Related record not found', 400)
    }
  }

  // Prisma validation errors (bad data shape)
  if (err instanceof Prisma.PrismaClientValidationError) {
    error = new ErrorResponse('Invalid data provided', 400)
  }

  const statusCode = (error as ErrorResponse).statusCode || 500
  sendTsRestError(res, statusCode, error.message)
}

// 404 Not Found handler
export const notFoundRoutes = (req: Request, res: Response) => {
  sendTsRestError(
    res,
    404,
    `Cannot find route - ${req.originalUrl} on this server. Please check the URL and try again.`
  )
}
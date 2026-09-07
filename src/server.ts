import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import fileUpload from 'express-fileupload'
import cookieParser from 'cookie-parser'

import { connectDB, gracefulShutDown } from './config/db.js'
import { env } from './config/key.js'
import logger, { logError } from './config/logger.js'
import createSessionMiddleware from './config/session.js'
import { globalLimiter } from './middlewares/rateLimit.middleware.js'
import {
  appErrorHandler,
  createExpressLogger,
  notFoundRoutes,
  setupGlobalErrorHandlers,
} from './middlewares/error.middleware.js'

import authRoutes from './routes/auth.routes.js'
import newsRoutes from './routes/news.routes.js'
import playerRoutes from './routes/player.routes.js'
import settingsRoutes from './routes/settings.routes.js'
import galleryRoutes from './routes/gallery.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import emailRoutes from './routes/email.routes.js'

// Extend express-session with UDESport's admin session shape
declare module 'express-session' {
  interface SessionData {
    userId?: string
    role?: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_ADMIN'
  }
}

const app = express()

setupGlobalErrorHandlers()

// Cron route first — lean path, no session/CORS needed, auth via x-cron-secret
app.use('/api', emailRoutes)

// CORS
app.use(
  cors({
    origin: [env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.set('trust proxy', 1)
app.use(createExpressLogger())
app.use(createSessionMiddleware())
app.use(globalLimiter)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(
  fileUpload({
    useTempFiles: false,
    limits: { fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
  })
)
app.use(cookieParser())
app.disable('x-powered-by')

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/players', playerRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/gallery', galleryRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'UDESport API is running' })
})

// 404 + error handler (must be last)
app.use(notFoundRoutes)
app.use(appErrorHandler)

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4200

const startServer = async (): Promise<void> => {
  let server: any
  try {
    await connectDB()
    server = app.listen(PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`)
      logger.info(`http://localhost:${PORT}`)
    })

    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)
      logger.error({ reason: error }, 'Unhandled rejection')
      server.close(() => {
        logger.info('Process terminated due to unhandled rejection')
      })
    })

    process.on('SIGTERM', gracefulShutDown)
    process.on('SIGINT', gracefulShutDown)

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') throw error
      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`)
          process.exit(1)
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`)
          process.exit(1)
        default:
          throw error
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logError(`Failed to start server: ${errorMessage}`)
    process.exit(1)
  }
}

if (!process.env.VERCEL) {
  startServer()
} else {
  connectDB().catch(err => {
    logger.error({ err }, 'Serverless DB connection failed')
  })
}

export default app
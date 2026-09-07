import prisma from './prisma.js'
import logger, { logError } from './logger.js'

interface DBConnect {
  isConnected: boolean
  retryCount: number
  maxRetries: number
}

const dbConnection: DBConnect = {
  isConnected: false,
  retryCount: 0,
  maxRetries: 5,
}

export const connectDB = async (): Promise<void> => {
  if (dbConnection.isConnected) {
    logger.info('Using existing PostgreSQL connection')
    return
  }

  if (dbConnection.retryCount >= dbConnection.maxRetries) {
    logger.error('X Max PostgreSQL connection retries reached')
    process.exit(1)
  }

  try {
    //Prisma connects lazily; $connect() forces it so we fail fast at boot
    await prisma.$connect()
    dbConnection.isConnected = true
    dbConnection.retryCount = 0 //reset retrycount upon successful connection
    logger.info('PostgreSQL Connected via Prisma')
  } catch (error: unknown) {
    dbConnection.retryCount++
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logError(
      `PostgreSQL connection failed (attempt ${dbConnection.retryCount}/${dbConnection.maxRetries}):`,
      errorMessage
    )

    if (dbConnection.retryCount < dbConnection.maxRetries) {
      logger.info('Retrying in 5 seconds...')
      setTimeout(connectDB, 5000)
    } else {
      logger.error('Max retries reached. Exiting...')
      process.exit(1)
    }
  }
}

//handle graceful shutdown
export const gracefulShutDown = async (): Promise<void> => {
  try {
    logger.info('Received shutdown signal. Closing server...')
    await prisma.$disconnect()
    logger.info('PostgreSQL connection closed')
    logger.info('Server shutdown complete')
    process.exit(0)
  } catch (error) {
    logError(error, 'error during shutdown')
    process.exit(1)
  }
}

//handle uncaught exception
process.on('uncaughtException', (error: Error) => {
  logger.error(
    {
      err: { name: error.name },
      message: error.message,
    },
    `UNCAUGHT EXCEPTIONS! Shutting down`
  )
  gracefulShutDown().finally(() => process.exit(1))
})
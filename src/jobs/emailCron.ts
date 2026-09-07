import prisma from '../config/prisma.js'
import logger from '../config/logger.js'
import { sendEmail } from '../email/send-email.js'

const BATCH_SIZE = 10

/**
 * Exponential backoff: retry 1 → 5 min, 2 → 25 min, 3 → 125 min, capped at 24h.
 */
const getBackoffDelay = (retryCount: number): number => {
  return Math.min(Math.pow(5, retryCount) * 60 * 1000, 24 * 60 * 60 * 1000)
}

/**
 * Process queued/failed emails due for retry. Called by Vercel Cron every 10 min.
 */
export const startEmailCron = async (): Promise<{ processed: number; sent: number; failed: number }> => {
  let sent = 0
  let failed = 0

  try {
    const now = new Date()

    const dueEmails = await prisma.emailQueue.findMany({
      where: {
        status: { in: ['QUEUED', 'FAILED'] },
        OR: [{ nextRetryAt: { lte: now } }, { nextRetryAt: null }],
      },
      orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
      take: BATCH_SIZE * 2, // over-fetch; filter retryCount < maxRetries in memory
    })

    // Prisma can't compare two columns inline ($expr in Mongo)
    const processable = dueEmails.filter(e => e.retryCount < e.maxRetries).slice(0, BATCH_SIZE)

    if (processable.length === 0) {
      logger.info('Email cron: no emails due for processing')
      return { processed: 0, sent: 0, failed: 0 }
    }

    logger.info({ count: processable.length }, `Email cron: processing ${processable.length} email(s)`)

    for (const email of processable) {
      try {
        await prisma.emailQueue.update({
          where: { id: email.id },
          data: { status: 'SENDING' },
        })

        const result = await sendEmail(email.to, email.subject, email.html)

        if (result.success) {
          await prisma.emailQueue.update({
            where: { id: email.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              retryCount: { increment: 1 },
            },
          })
          sent++
          logger.info({ emailId: email.id }, 'Email sent successfully')
        } else {
          throw new Error(result.error || 'Send returned failure')
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        const errStack = error instanceof Error ? error.stack : undefined
        const nextRetryAt = new Date(Date.now() + getBackoffDelay(email.retryCount + 1))

        await prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'FAILED',
            lastError: errMsg,
            lastErrorStack: errStack,
            nextRetryAt,
            failedAt: new Date(),
            retryCount: { increment: 1 },
          },
        })
        failed++
        logger.error({ emailId: email.id, error: errMsg, retryCount: email.retryCount + 1 }, 'Email send failed')
      }
    }

    logger.info({ sent, failed }, 'Email cron: batch complete')
    return { processed: processable.length, sent, failed }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ err: error }, `Email cron: error querying email queue: ${errMsg}`)
    return { processed: 0, sent: 0, failed: 0 }
  }
}

export default { startEmailCron }
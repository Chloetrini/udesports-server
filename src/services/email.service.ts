import sendEmail from '../email/send-email.js'
import { inviteEmailTemplate, passwordResetEmailTemplate, newsletterNotificationTemplate } from '../lib/emailTemplate.js'
import prisma from '../config/prisma.js'
import { env } from '../config/key.js'
import logger from '../config/logger.js'

export class EmailService {
  /**
   * Send an admin invite. Immediate send; queues for cron retry on failure.
   */
  static async sendInviteEmail({
    name,
    email,
    invitedBy,
    inviteUrl,
    role,
  }: {
    name: string
    email: string
    invitedBy: string
    inviteUrl: string
    role: string
  }): Promise<{ success: boolean; queued: boolean }> {
    const { subject, html } = inviteEmailTemplate(name, invitedBy, inviteUrl, role)

    const result = await sendEmail({ email, subject, message: html })
    if (result.success) {
      return { success: true, queued: false }
    }

    await prisma.emailQueue.create({
      data: {
        to: [email],
        subject,
        html,
        priority: 'HIGH',
        status: 'QUEUED',
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })
    return { success: false, queued: true }
  }

  /**
   * Send a password reset code. Immediate send; queues on failure.
   */
  static async sendPasswordResetEmail({
    name,
    email,
    code,
  }: {
    name: string
    email: string
    code: string
  }): Promise<{ success: boolean; queued: boolean }> {
    const { subject, html } = passwordResetEmailTemplate(name, code)

    const result = await sendEmail({ email, subject, message: html })
    if (result.success) {
      return { success: true, queued: false }
    }

    await prisma.emailQueue.create({
      data: {
        to: [email],
        subject,
        html,
        priority: 'HIGH',
        status: 'QUEUED',
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })
    return { success: false, queued: true }
  }

  /**
   * Notify every subscriber that a News article or Quick Update just went
   * live. Deliberately does NOT call sendEmail directly — Brevo's `to`
   * array has no bcc separation, so putting every subscriber's address in
   * one call would expose the whole list to each recipient. Instead this
   * queues one EmailQueue row per subscriber (same table/pattern as
   * invites and password resets) and lets the existing cron in
   * emailCron.ts send them one at a time, a few every 10 minutes.
   */
  static async notifySubscribers({
    kind,
    headline,
    category,
    path,
  }: {
    kind: 'News' | 'Quick Update'
    headline: string
    category: string
    path: string // e.g. `/news/${id}` — appended to CLIENT_URL
  }): Promise<{ queued: number }> {
    const subscribers = await prisma.subscriber.findMany({
      select: { email: true, unsubscribeToken: true },
    })

    if (subscribers.length === 0) {
      return { queued: 0 }
    }

    const url = `${env.CLIENT_URL}${path}`

    await prisma.emailQueue.createMany({
      data: subscribers.map(sub => {
        const unsubscribeUrl = `${env.CLIENT_URL}/unsubscribe?token=${sub.unsubscribeToken}`
        const { subject, html } = newsletterNotificationTemplate(kind, headline, category, url, unsubscribeUrl)
        return {
          to: [sub.email],
          subject,
          html,
          priority: 'LOW' as const,
          status: 'QUEUED' as const,
          retryCount: 0,
          nextRetryAt: null,
        }
      }),
    })

    logger.info({ count: subscribers.length, kind, headline }, 'Newsletter: queued subscriber notifications')
    return { queued: subscribers.length }
  }
}

export const emailService = new EmailService()

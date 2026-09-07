import sendEmail from '../email/send-email.js'
import { inviteEmailTemplate, passwordResetEmailTemplate } from '../lib/emailTemplate.js'
import prisma from '../config/prisma.js'

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
}

export const emailService = new EmailService()
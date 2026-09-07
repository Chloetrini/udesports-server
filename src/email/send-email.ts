import axios from 'axios'
import { env } from '../config/key.js'
import logger, { logError } from '../config/logger.js'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export interface SendEmailOptions {
  email: string
  subject: string
  message: string
  attachments?: { filename: string; content: Buffer | string }[]
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Strip HTML tags and entities for plain-text fallback.
 */
const toTextFallback = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Low-level send — every public export funnels through here.
 */
const sendViaBrevo = async (
  to: string | string[],
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer | string }[]
): Promise<SendEmailResult> => {
  try {
    const recipients = (Array.isArray(to) ? to : [to]).map(email => ({ email }))

    const payload: Record<string, any> = {
      sender: { name: 'UDESport Management', email: env.EMAIL_OWNER || env.EMAIL_FROM },
      to: recipients,
      subject,
      htmlContent: html,
      textContent: toTextFallback(html),
    }

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(att => ({
        name: att.filename,
        content:
          typeof att.content === 'string'
            ? Buffer.from(att.content).toString('base64')
            : att.content.toString('base64'),
      }))
    }

    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 15000,
    })

    if (env.NODE_ENV === 'development') {
      logger.info(`Email sent successfully via Brevo! Message ID: ${response.data.messageId}`)
    }

    return { success: true, messageId: response.data.messageId }
  } catch (error: any) {
    const errorData = error.response?.data
    logError(error, 'Brevo email sending failed', {
      message: error.message,
      details: errorData || 'No additional details',
    })

    return { success: false, error: error.message }
  }
}

/**
 * Named export — positional args. Used by the cron job.
 *   sendEmail(to, subject, html)
 */
export const sendEmail = async (to: string | string[], subject: string, html: string): Promise<SendEmailResult> => {
  return sendViaBrevo(to, subject, html)
}

/**
 * Object-arg export matching the auth controller's shape.
 *   sendEmailToRecipient({ to, subject, html })
 */
export const sendEmailToRecipient = async ({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}): Promise<SendEmailResult> => {
  return sendViaBrevo(to, subject, html)
}

/**
 * Default export — options object. Used by EmailService.
 *   sendEmail({ email, subject, message })
 */
const sendEmailWithOptions = async (options: SendEmailOptions): Promise<SendEmailResult> => {
  return sendViaBrevo(options.email, options.subject, options.message, options.attachments)
}

export default sendEmailWithOptions
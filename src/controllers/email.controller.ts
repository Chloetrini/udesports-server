import { Request, Response } from 'express'
import { env } from '../config/key.js'
import { startEmailCron } from '../jobs/emailCron.js'
import { sendTsRestError, sendTsRestSuccess } from '../lib/responseHandler.js'
import tryCatchWrapper from  '../lib/tryCatchWrapper.js'

export const checkEmailCron = tryCatchWrapper(async (req: Request, res: Response) => {
  // Vercel's built-in Cron Jobs feature calls this route itself and signs
  // the request with `Authorization: Bearer <CRON_SECRET>` — it does not
  // support setting a custom header like `x-cron-secret`. Accept both so
  // this still works if it's ever triggered by an external scheduler that
  // *can* set arbitrary headers instead of Vercel's own cron.
  const authHeader = req.headers.authorization;
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const cronSecret = bearerSecret || req.headers['x-cron-secret'];

  if (!cronSecret || cronSecret !== env.CRON_SECRET) {
    return sendTsRestError(res, 401, 'Unauthorized: invalid or missing CRON_SECRET')
  }

  const result = await startEmailCron()

  return sendTsRestSuccess(res, 200, {
    success: true,
    message: 'Email cron job completed',
    body: result,
  })
})

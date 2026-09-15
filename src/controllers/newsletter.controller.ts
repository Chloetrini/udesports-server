import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";
import { EmailService } from "../services/email.service.js";
import logger from "../config/logger.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SUBSCRIBE — public, powers the footer "Join our newsletter" form.
export const subscribe = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const emailRaw = req.body?.email;
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return sendTsRestError(res, 400, "Please enter a valid email address");
  }

  const existing = await prisma.subscriber.findUnique({ where: { email } });
  if (existing) {
    // Already subscribed — treat as success so the form doesn't leak
    // whether an address is on the list already.
    sendTsRestSuccess(res, 200, {
      success: true,
      message: "You're already subscribed — thanks for being with us!",
      body: {},
    });
    return;
  }

  const subscriber = await prisma.subscriber.create({ data: { email } });

  // Fire the welcome email, but don't fail the subscribe request if Brevo
  // is down — the subscriber row is already created either way, and
  // sendWelcomeEmail queues itself for retry on failure.
  try {
    await EmailService.sendWelcomeEmail({ email: subscriber.email, unsubscribeToken: subscriber.unsubscribeToken });
  } catch (err) {
    logger.error({ err, email }, "Newsletter: welcome email failed to send or queue");
  }

  sendTsRestSuccess(res, 201, {
    success: true,
    message: "Subscribed! You'll get an email whenever we post news or updates.",
    body: {},
  });
});

// UNSUBSCRIBE — public, one-click link included in every notification email.
export const unsubscribe = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token as string;

  const subscriber = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!subscriber) {
    return sendTsRestError(res, 404, "This unsubscribe link is invalid or has already been used");
  }

  await prisma.subscriber.delete({ where: { id: subscriber.id } });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "You've been unsubscribed. Sorry to see you go!",
    body: {},
  });
});

// GET ALL SUBSCRIBERS (admin — just a count + list, no CRUD needed)
export const getAllSubscribersAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, createdAt: true },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Subscribers fetched successfully",
    body: { count: subscribers.length, subscribers },
  });
});


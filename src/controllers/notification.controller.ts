import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// CREATE NOTIFICATION (public — from the website contact form)
export const createNotification = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { senderName, email, subject, body } = req.body;

  if (!senderName || !subject || !body) {
    return sendTsRestError(res, 400, "Name, subject, and message are required");
  }

  const notification = await prisma.notification.create({
    data: { senderName, email: email || null, subject, body },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: "Message sent",
    body: { notification },
  });
});

// GET ALL NOTIFICATIONS (admin) — newest first, with unread count
export const getNotifications = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
  });
  const unreadCount = await prisma.notification.count({ where: { isRead: false } });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Notifications fetched successfully",
    body: { count: notifications.length, unreadCount, notifications },
  });
});

// MARK ONE AS READ
export const markAsRead = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Notification not found");
  }

  const notification = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Marked as read",
    body: { notification },
  });
});

// MARK ALL AS READ
export const markAllAsRead = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });

  sendTsRestSuccess(res, 200, { success: true, message: "All marked as read" });
});

// DELETE NOTIFICATION
export const deleteNotification = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Notification not found");
  }

  await prisma.notification.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Notification deleted" });
});
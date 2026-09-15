import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";
import { EmailService } from "../services/email.service.js";
import logger from "../config/logger.js";

// GET ALL QUICK UPDATES (public — only published, newest first, capped)
export const getAllQuickUpdates = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const updates = await prisma.quickUpdate.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { author: { select: { name: true } } },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Quick updates fetched successfully",
    body: { count: updates.length, updates },
  });
});

// GET ALL QUICK UPDATES (admin — includes drafts)
export const getAllQuickUpdatesAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const updates = await prisma.quickUpdate.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Quick updates fetched successfully",
    body: { count: updates.length, updates },
  });
});

// CREATE QUICK UPDATE
export const createQuickUpdate = tryCatchWrapper(async (req: AuthRequest, res: Response): Promise<void> => {
  const { headline, category, isDraft } = req.body;

  if (!headline || !category) {
    return sendTsRestError(res, 400, "Headline and category are required");
  }

  const update = await prisma.quickUpdate.create({
    data: {
      headline,
      category,
      published: isDraft === "true" || isDraft === true ? false : true,
      authorId: req.admin!.id,
    },
    include: { author: { select: { name: true } } },
  });

  if (update.published) {
    try {
      await EmailService.notifySubscribers({
        kind: "Quick Update",
        headline: update.headline,
        category: update.category,
        path: `/news`,
      });
    } catch (err) {
      logger.error({ err, updateId: update.id }, "Newsletter: failed to queue subscriber notifications for new quick update");
    }
  }

  sendTsRestSuccess(res, 201, {
    success: true,
    message: update.published ? "Quick update published successfully" : "Quick update saved to drafts",
    body: { update },
  });
});

// UPDATE QUICK UPDATE
export const updateQuickUpdate = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.quickUpdate.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Quick update not found");
  }

  const { headline, category, isDraft } = req.body;

  const update = await prisma.quickUpdate.update({
    where: { id },
    data: {
      headline: headline ?? undefined,
      category: category ?? undefined,
      published: isDraft === undefined ? undefined : !(isDraft === "true" || isDraft === true),
    },
    include: { author: { select: { name: true } } },
  });

  if (!existing.published && update.published) {
    try {
      await EmailService.notifySubscribers({
        kind: "Quick Update",
        headline: update.headline,
        category: update.category,
        path: `/news`,
      });
    } catch (err) {
      logger.error({ err, updateId: update.id }, "Newsletter: failed to queue subscriber notifications for published quick update");
    }
  }

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Quick update updated successfully",
    body: { update },
  });
});

// DELETE QUICK UPDATE
export const deleteQuickUpdate = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.quickUpdate.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Quick update not found");
  }

  await prisma.quickUpdate.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Quick update deleted successfully" });
});

import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET ALL HEADLINES (public — only published, powers the scrolling ticker bar)
export const getAllHeadlines = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const headlines = await prisma.headline.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Headlines fetched successfully",
    body: { count: headlines.length, headlines },
  });
});

// GET ALL HEADLINES (admin — includes drafts)
export const getAllHeadlinesAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const headlines = await prisma.headline.findMany({
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Headlines fetched successfully",
    body: { count: headlines.length, headlines },
  });
});

// CREATE HEADLINE
export const createHeadline = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { category, headline, isDraft } = req.body;

  if (!category || !headline) {
    return sendTsRestError(res, 400, "Category and headline are required");
  }

  const created = await prisma.headline.create({
    data: {
      category,
      headline,
      published: isDraft === "true" || isDraft === true ? false : true,
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: created.published ? "Headline published successfully" : "Headline saved to drafts",
    body: { headline: created },
  });
});

// UPDATE HEADLINE
export const updateHeadline = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.headline.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Headline not found");
  }

  const { category, headline, isDraft } = req.body;

  const updated = await prisma.headline.update({
    where: { id },
    data: {
      category: category ?? undefined,
      headline: headline ?? undefined,
      published: isDraft === undefined ? undefined : !(isDraft === "true" || isDraft === true),
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Headline updated successfully",
    body: { headline: updated },
  });
});

// DELETE HEADLINE
export const deleteHeadline = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.headline.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Headline not found");
  }

  await prisma.headline.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Headline deleted successfully" });
});

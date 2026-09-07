import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET ALL NEWS (public — only published articles)
export const getAllNews = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const news = await prisma.news.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    include: { featuredPlayer: true, author: { select: { name: true } } },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "News fetched successfully",
    body: { count: news.length, news },
  });
});

// GET ALL NEWS (admin — includes drafts)
export const getAllNewsAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const news = await prisma.news.findMany({
    orderBy: { createdAt: "desc" },
    include: { featuredPlayer: true, author: { select: { name: true } } },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "News fetched successfully",
    body: { count: news.length, news },
  });
});

// GET SINGLE NEWS ARTICLE
export const getNews = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const news = await prisma.news.findUnique({
    where: { id },
    include: { featuredPlayer: true, author: { select: { name: true } } },
  });

  if (!news) {
    return sendTsRestError(res, 404, "Article not found");
  }

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Article fetched successfully",
    body: { news },
  });
});

// CREATE NEWS ARTICLE
export const createNews = tryCatchWrapper(async (req: AuthRequest, res: Response): Promise<void> => {
  const { headline, category, summary, body, featuredPlayerId, isDraft } = req.body;

  if (!headline || !category || !body) {
    return sendTsRestError(res, 400, "Headline, category, and body are required");
  }

  // Upload cover image if provided
  let coverImage: string | null = null;
  if (req.files && req.files.coverImage) {
    const file = (Array.isArray(req.files.coverImage)
      ? req.files.coverImage[0]
      : req.files.coverImage) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/news", transformation: [{ width: 1200, quality: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    coverImage = result.secure_url;
  }

  const news = await prisma.news.create({
    data: {
      headline,
      category, // TRANSFER / ACADEMY / ANNOUNCEMENT
      summary: summary || null,
      body,
      coverImage,
      published: isDraft === "true" || isDraft === true ? false : true, // Publish vs Draft
      featuredPlayerId: featuredPlayerId || null,
      authorId: req.admin!.id, // the logged-in admin
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: news.published ? "Article published successfully" : "Article saved to drafts",
    body: { news },
  });
});

// UPDATE NEWS ARTICLE
export const updateNews = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Article not found");
  }

  const { headline, category, summary, body, featuredPlayerId, isDraft } = req.body;

  // keep current cover unless a new one is uploaded
  let coverImage = existing.coverImage;
  if (req.files && req.files.coverImage) {
    const file = (Array.isArray(req.files.coverImage)
      ? req.files.coverImage[0]
      : req.files.coverImage) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "udesport/news" }, (error, result) => {
          if (error || !result) reject(error);
          else resolve(result);
        })
        .end(file.data);
    });
    coverImage = result.secure_url;
  }

  const news = await prisma.news.update({
    where: { id },
    data: {
      headline: headline ?? undefined,
      category: category ?? undefined,
      summary: summary ?? undefined,
      body: body ?? undefined,
      featuredPlayerId: featuredPlayerId ?? undefined,
      published: isDraft === undefined ? undefined : !(isDraft === "true" || isDraft === true),
      coverImage,
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Article updated successfully",
    body: { news },
  });
});

// DELETE NEWS ARTICLE
export const deleteNews = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Article not found");
  }

  await prisma.news.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Article deleted successfully" });
});
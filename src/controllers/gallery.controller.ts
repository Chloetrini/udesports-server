import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET ALL GALLERY ITEMS (public — published only)
export const getGallery = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const items = await prisma.galleryItem.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Gallery fetched successfully",
    body: { count: items.length, items },
  });
});

// GET ALL GALLERY ITEMS (admin — includes drafts)
export const getGalleryAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const items = await prisma.galleryItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Gallery fetched successfully",
    body: { count: items.length, items },
  });
});

// CREATE GALLERY ITEM
export const createGalleryItem = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { headline, instaUrl, description, isDraft } = req.body;

  // upload cover image if a file was sent
  let coverImage: string | null = null;
  if (req.files && req.files.coverImage) {
    const file = (Array.isArray(req.files.coverImage)
      ? req.files.coverImage[0]
      : req.files.coverImage) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/gallery", transformation: [{ width: 1200, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    coverImage = result.secure_url;
  }

  const item = await prisma.galleryItem.create({
    data: {
      headline: headline || null,
      instaUrl: instaUrl || null,
      description: description || null,
      coverImage,
      published: isDraft === "true" || isDraft === true ? false : true,
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: item.published ? "Photo published" : "Photo saved to drafts",
    body: { item },
  });
});

// UPDATE GALLERY ITEM
export const updateGalleryItem = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.galleryItem.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Gallery item not found");
  }

  const { headline, instaUrl, description, isDraft } = req.body;

  // keep current cover unless a new one is uploaded
  let coverImage = existing.coverImage;
  if (req.files && req.files.coverImage) {
    const file = (Array.isArray(req.files.coverImage)
      ? req.files.coverImage[0]
      : req.files.coverImage) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/gallery", transformation: [{ width: 1200, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    coverImage = result.secure_url;
  }

  const item = await prisma.galleryItem.update({
    where: { id },
    data: {
      headline: headline ?? undefined,
      instaUrl: instaUrl ?? undefined,
      description: description ?? undefined,
      published: isDraft === undefined ? undefined : !(isDraft === "true" || isDraft === true),
      coverImage,
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Gallery item updated",
    body: { item },
  });
});

// DELETE GALLERY ITEM
export const deleteGalleryItem = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.galleryItem.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Gallery item not found");
  }

  await prisma.galleryItem.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Gallery item deleted" });
});

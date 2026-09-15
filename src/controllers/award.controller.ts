import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET ALL AWARDS (public — only published, powers the About page Award & Certification section)
export const getAwards = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const awards = await prisma.award.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Awards fetched successfully",
    body: { count: awards.length, awards },
  });
});

// GET ALL AWARDS (admin — includes drafts)
export const getAwardsAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const awards = await prisma.award.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Awards fetched successfully",
    body: { count: awards.length, awards },
  });
});

// CREATE AWARD
export const createAward = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { name, subtitle, order, isDraft } = req.body;

  if (!name || !subtitle) {
    return sendTsRestError(res, 400, "Name and subtitle are required");
  }

  let image: string | null = null;
  if (req.files && req.files.image) {
    const file = (Array.isArray(req.files.image) ? req.files.image[0] : req.files.image) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/awards", transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    image = result.secure_url;
  }

  const award = await prisma.award.create({
    data: {
      name,
      subtitle,
      image,
      order: order !== undefined && order !== "" ? Number(order) : 0,
      published: isDraft === "true" || isDraft === true ? false : true,
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: award.published ? "Award published" : "Award saved to drafts",
    body: { award },
  });
});

// UPDATE AWARD
export const updateAward = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.award.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Award not found");
  }

  const { name, subtitle, order, isDraft } = req.body;

  // keep current image unless a new one is uploaded
  let image = existing.image;
  if (req.files && req.files.image) {
    const file = (Array.isArray(req.files.image) ? req.files.image[0] : req.files.image) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/awards", transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    image = result.secure_url;
  }

  const award = await prisma.award.update({
    where: { id },
    data: {
      name: name ?? undefined,
      subtitle: subtitle ?? undefined,
      order: order !== undefined && order !== "" ? Number(order) : undefined,
      published: isDraft === undefined ? undefined : !(isDraft === "true" || isDraft === true),
      image,
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Award updated successfully",
    body: { award },
  });
});

// DELETE AWARD
export const deleteAward = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.award.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Award not found");
  }

  await prisma.award.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Award deleted successfully" });
});

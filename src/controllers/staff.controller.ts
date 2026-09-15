import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET ALL STAFF (public — only published, powers the About page team section)
export const getStaff = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const staff = await prisma.staffMember.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Staff fetched successfully",
    body: { count: staff.length, staff },
  });
});

// GET ALL STAFF (admin — includes drafts)
export const getStaffAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const staff = await prisma.staffMember.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Staff fetched successfully",
    body: { count: staff.length, staff },
  });
});

// CREATE STAFF MEMBER
export const createStaffMember = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { name, role, verified, order, isDraft } = req.body;

  if (!name || !role) {
    return sendTsRestError(res, 400, "Name and role are required");
  }

  let photo: string | null = null;
  if (req.files && req.files.photo) {
    const file = (Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/staff", transformation: [{ width: 600, height: 600, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    photo = result.secure_url;
  }

  const member = await prisma.staffMember.create({
    data: {
      name,
      role,
      photo,
      verified: verified === "false" || verified === false ? false : true,
      order: order !== undefined && order !== "" ? Number(order) : 0,
      published: isDraft === "true" || isDraft === true ? false : true,
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: member.published ? "Staff member published" : "Staff member saved to drafts",
    body: { member },
  });
});

// UPDATE STAFF MEMBER
export const updateStaffMember = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.staffMember.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Staff member not found");
  }

  const { name, role, verified, order, isDraft } = req.body;

  // keep current photo unless a new one is uploaded
  let photo = existing.photo;
  if (req.files && req.files.photo) {
    const file = (Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/staff", transformation: [{ width: 600, height: 600, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    photo = result.secure_url;
  }

  const member = await prisma.staffMember.update({
    where: { id },
    data: {
      name: name ?? undefined,
      role: role ?? undefined,
      verified: verified === undefined ? undefined : !(verified === "false" || verified === false),
      order: order !== undefined && order !== "" ? Number(order) : undefined,
      published: isDraft === undefined ? undefined : !(isDraft === "true" || isDraft === true),
      photo,
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Staff member updated successfully",
    body: { member },
  });
});

// DELETE STAFF MEMBER
export const deleteStaffMember = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.staffMember.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Staff member not found");
  }

  await prisma.staffMember.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Staff member deleted successfully" });
});

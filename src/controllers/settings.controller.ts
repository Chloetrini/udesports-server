import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET SITE SETTINGS (public — site title, socials shown on website)
// Returns the single settings record, or null if not set yet
export const getSettings = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  // there's only ever one settings row — grab the first
  const settings = await prisma.siteSettings.findFirst();

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Settings fetched successfully",
    body: { settings },
  });
});

// UPDATE SITE SETTINGS (admin)
// Creates the record on first save, updates it thereafter (upsert pattern)
export const updateSettings = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { siteTitle, contact, email, instagram, twitter } = req.body;

  if (!siteTitle) {
    return sendTsRestError(res, 400, "Site title is required");
  }

  // check if a settings row already exists
  const existing = await prisma.siteSettings.findFirst();

  let settings;
  if (existing) {
    // update the existing row
    settings = await prisma.siteSettings.update({
      where: { id: existing.id },
      data: {
        siteTitle,
        contact: contact ?? undefined,
        email: email ?? undefined,
        instagram: instagram ?? undefined,
        twitter: twitter ?? undefined,
      },
    });
  } else {
    // first time — create it
    settings = await prisma.siteSettings.create({
      data: {
        siteTitle,
        contact: contact || null,
        email: email || null,
        instagram: instagram || null,
        twitter: twitter || null,
      },
    });
  }

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Settings saved successfully",
    body: { settings },
  });
});
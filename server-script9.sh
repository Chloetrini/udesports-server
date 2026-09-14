#!/bin/bash
set -e

echo 'Applying server-script9: fixes slow/oversized player, gallery and news photo uploads — every upload path now resizes and auto-optimizes through Cloudinary (previously only some paths did, which is why some photos uploaded via edit/update were left at full original resolution)...'

mkdir -p "$(dirname 'src/controllers/player.controller.ts')"
cat > 'src/controllers/player.controller.ts' << 'UDESPORT_EOF_0_S9'
import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// Uploads a single image field (if present in req.files) to Cloudinary and
// returns its secure URL. Shared by playerPhoto and both club-logo fields so
// the upload_stream boilerplate isn't repeated for every field.
async function uploadImageField(
  req: Request,
  field: string,
  folder: string
): Promise<string | null> {
  if (!req.files || !req.files[field]) return null;

  const file = (Array.isArray(req.files[field])
    ? req.files[field][0]
    : req.files[field]) as UploadedFile;

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, transformation: [{ width: 400, quality: "auto", fetch_format: "auto" }] }, (error, result) => {
        if (error || !result) reject(error);
        else resolve(result);
      })
      .end(file.data);
  });

  return result.secure_url;
}

// GET ALL PLAYERS (public — only published players are visible on the live site)
export const getPlayers = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const players = await prisma.player.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Players fetched successfully",
    body: { count: players.length, players },
  });
});

// GET ALL PLAYERS (admin — includes drafts, so a saved-as-draft player is
// still visible in the admin list even though it's hidden from the public site)
export const getPlayersAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const players = await prisma.player.findMany({
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Players fetched successfully",
    body: { count: players.length, players },
  });
});

// GET SINGLE PLAYER
export const getPlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const player = await prisma.player.findUnique({
    where: { id: req.params.id as string },
  });

  if (!player) {
    return sendTsRestError(res, 404, "Player not found");
  }

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Player fetched successfully",
    body: { player },
  });
});

// CREATE PLAYER
export const createPlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const {
    playerName,
    playerFullName,
    DOB,
    nationality,
    height,
    preferredFoot,
    ageGroup,
    status,
    position,
    goals,
    assists,
    saves,
    cleanSheets,
    rating,
    currentClubName,
    currentClubLogo,
    newClubName,
    newClubLogo,
    playerHistory,
    playerAppearance,
    isFeatured,
    published,
  } = req.body;

  // prevent duplicate player names
  const existingName = await prisma.player.findFirst({ where: { playerName } });
  if (existingName) {
    return sendTsRestError(res, 400, "Player name already exists");
  }

  // Upload player image to Cloudinary — only if a file was sent
  let playerPhoto: string | null = null;

  if (req.files && req.files.playerPhoto) {
    const file = (Array.isArray(req.files.playerPhoto)
      ? req.files.playerPhoto[0]
      : req.files.playerPhoto) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/players", transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    playerPhoto = result.secure_url;
  }

  // Club logos: an uploaded file (if provided) wins over a pasted URL.
  const uploadedCurrentClubLogo = await uploadImageField(req, "currentClubLogo", "udesport/clubs");
  const uploadedNewClubLogo = await uploadImageField(req, "newClubLogo", "udesport/clubs");

  const player = await prisma.player.create({
    data: {
      playerName,
      playerFullName: playerFullName || null,
      DOB: new Date(DOB),
      nationality,
      height: height ? Number(height) : null,
      preferredFoot,
      ageGroup,
      status: status || "FREE",
      position,
      goals: goals ? Number(goals) : 0,
      assists: assists ? Number(assists) : 0,
      saves: saves ? Number(saves) : 0,
      cleanSheets: cleanSheets ? Number(cleanSheets) : 0,
      rating: rating ? Number(rating) : null,
      currentClubName: currentClubName || null,
      currentClubLogo: uploadedCurrentClubLogo || currentClubLogo || null,
      newClubName: newClubName || null,
      newClubLogo: uploadedNewClubLogo || newClubLogo || null,
      playerHistory: playerHistory || null,
      playerAppearance: playerAppearance ? Number(playerAppearance) : 0,
      isFeatured: isFeatured === "true" || isFeatured === true ? true : false,
      // Defaults to published so a plain create (no publish flag sent) never
      // silently hides a player; the admin form's Save as Draft button is
      // what explicitly sends published: false.
      published: published === undefined ? true : published === "true" || published === true,
      playerPhoto,
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: "Player added successfully",
    body: { player },
  });
});

// UPDATE PLAYER
export const updatePlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.player.findUnique({
    where: { id: req.params.id as string },
  });

  if (!existing) {
    return sendTsRestError(res, 404, "Player not found");
  }

  const {
    playerName,
    playerFullName,
    DOB,
    nationality,
    height,
    preferredFoot,
    ageGroup,
    status,
    position,
    goals,
    assists,
    saves,
    cleanSheets,
    rating,
    currentClubName,
    currentClubLogo,
    newClubName,
    newClubLogo,
    playerHistory,
    playerAppearance,
    isFeatured,
    published,
  } = req.body;

  // keep current photo; replace only if a new one is uploaded
  let playerPhoto = existing.playerPhoto;

  if (req.files && req.files.playerPhoto) {
    const file = (Array.isArray(req.files.playerPhoto)
      ? req.files.playerPhoto[0]
      : req.files.playerPhoto) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/players", transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    playerPhoto = result.secure_url;
  }

  // Club logos: an uploaded file (if provided) wins over a pasted URL;
  // otherwise fall back to whatever was sent as a plain string (or leave
  // untouched, same as every other field, if nothing was sent at all).
  const uploadedCurrentClubLogo = await uploadImageField(req, "currentClubLogo", "udesport/clubs");
  const uploadedNewClubLogo = await uploadImageField(req, "newClubLogo", "udesport/clubs");

  // Prisma ignores `undefined`, so unsent fields stay untouched
  const player = await prisma.player.update({
    where: { id: req.params.id as string },
    data: {
      playerName: playerName ?? undefined,
      playerFullName: playerFullName ?? undefined,
      DOB: DOB ? new Date(DOB) : undefined,
      nationality: nationality ?? undefined,
      height: height !== undefined ? Number(height) : undefined,
      preferredFoot: preferredFoot ?? undefined,
      ageGroup: ageGroup ?? undefined,
      status: status ?? undefined,
      position: position ?? undefined,
      goals: goals !== undefined ? Number(goals) : undefined,
      assists: assists !== undefined ? Number(assists) : undefined,
      saves: saves !== undefined ? Number(saves) : undefined,
      cleanSheets: cleanSheets !== undefined ? Number(cleanSheets) : undefined,
      rating: rating !== undefined ? Number(rating) : undefined,
      currentClubName: currentClubName ?? undefined,
      currentClubLogo: uploadedCurrentClubLogo ?? currentClubLogo ?? undefined,
      newClubName: newClubName ?? undefined,
      newClubLogo: uploadedNewClubLogo ?? newClubLogo ?? undefined,
      playerHistory: playerHistory ?? undefined,
      playerAppearance: playerAppearance !== undefined ? Number(playerAppearance) : undefined,
      isFeatured:
        isFeatured === undefined ? undefined : isFeatured === "true" || isFeatured === true,
      published:
        published === undefined ? undefined : published === "true" || published === true,
      playerPhoto,
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Player updated successfully",
    body: { player },
  });
});

// DELETE PLAYER
export const deletePlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.player.findUnique({
    where: { id: req.params.id as string },
  });

  if (!existing) {
    return sendTsRestError(res, 404, "Player not found");
  }

  await prisma.player.delete({ where: { id: req.params.id as string } });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Player deleted successfully",
  });
});

// DASHBOARD STATS — powers the Overview screen
export const getDashboardStats = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const calcPercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // ---- TOP CARDS ----
  const totalPlayers = await prisma.player.count();
  const lastMonthPlayers = await prisma.player.count({
    where: { createdAt: { lt: startOfThisMonth } },
  });

  const publishedArticles = await prisma.news.count({
    where: { published: true },
  });
  const articlesToday = await prisma.news.count({
    where: { published: true, createdAt: { gte: startOfToday } },
  });

  // ---- AGE GROUP STATS ----
  const u17 = await prisma.player.count({ where: { ageGroup: "U-17" } });
  const u21 = await prisma.player.count({ where: { ageGroup: "U-21" } });
  const u23 = await prisma.player.count({ where: { ageGroup: "U-23" } });
  const professional = await prisma.player.count({ where: { ageGroup: "Professional" } });
  const freeAgents = await prisma.player.count({ where: { status: "FREE" } });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Dashboard stats fetched successfully",
    body: {
      stats: {
        playersThisSeason: {
          count: totalPlayers,
          percent: calcPercent(totalPlayers, lastMonthPlayers),
        },
        completedTransfers: { count: 0 },
        liveNegotiations: { count: 0 },
        publishedArticles: { count: publishedArticles, today: articlesToday },
        transferStats: {
          totalTransfers: 0,
          thisSeason: 0,
          inNegotiation: 0,
        },
        ageGroupStats: { u17, u21, u23, professional, freeAgents },
      },
    },
  });
});
UDESPORT_EOF_0_S9

mkdir -p "$(dirname 'src/controllers/gallery.controller.ts')"
cat > 'src/controllers/gallery.controller.ts' << 'UDESPORT_EOF_1_S9'
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
UDESPORT_EOF_1_S9

mkdir -p "$(dirname 'src/controllers/news.controller.ts')"
cat > 'src/controllers/news.controller.ts' << 'UDESPORT_EOF_2_S9'
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
          { folder: "udesport/news", transformation: [{ width: 1200, quality: "auto", fetch_format: "auto" }] },
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
        .upload_stream(
          { folder: "udesport/news", transformation: [{ width: 1200, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
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
UDESPORT_EOF_2_S9

echo 'Done. Run: npx tsc --noEmit'

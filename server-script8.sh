#!/bin/bash
set -e

echo 'Applying server-script8: real publish/draft support for players (new published column + migration + admin list route)...'

mkdir -p "$(dirname 'prisma/schema.prisma')"
cat > 'prisma/schema.prisma' << 'UDESPORT_SRV_EOF_0_6'
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum PlayerStatus {
  FREE
  TRANSFERRED
  NEGOTIATION
  RETIRED
}

enum NewsCategory {
  TRANSFER
  ACADEMY
  ANNOUNCEMENT
}

enum AdminRole {
  SUPER_ADMIN
  ADMIN
  SUB_ADMIN
}

model Player {
  id              String       @id @default(uuid())
  playerName      String
  playerFullName  String?
  playerPhoto     String?
  DOB             DateTime
  nationality     String
  height          Int?
  preferredFoot   String
  ageGroup        String
  status          PlayerStatus @default(FREE)
  position        String
  goals           Int          @default(0)
  assists         Int          @default(0)
  saves           Int          @default(0)
  cleanSheets     Int          @default(0)
  rating          Int?
  currentClubName String?
  currentClubLogo String?
  newClubName     String?
  newClubLogo     String?
  playerHistory   String?
  playerAppearance Int         @default(0)
  isFeatured      Boolean      @default(false)
  published       Boolean      @default(true)

  featuredIn      News[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}
model News {
  id               String       @id @default(uuid())
  headline         String
  category         NewsCategory
  summary          String?
  body             String
  coverImage       String?
  published        Boolean      @default(false)
  featuredPlayer   Player?      @relation(fields: [featuredPlayerId], references: [id])
  featuredPlayerId String?
  author           Admin        @relation(fields: [authorId], references: [id])
  authorId         String
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}

model Admin {
  id                  String    @id @default(uuid())
  name                String
  email               String    @unique
  password            String?   // nullable — invited admins have no password until they set one
  role                AdminRole @default(ADMIN)

  // ---- account status ----
  isActive            Boolean   @default(false) // becomes true once they set their password

  // ---- invite flow (set-password link) ----
  inviteToken         String?
  inviteExpire        DateTime?

  // ---- password reset flow ----
  resetPasswordToken  String?
  resetPasswordExpire DateTime?

  articles            News[]
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

model GalleryItem {
  id          String   @id @default(uuid())
  headline    String?
  instaUrl    String?
  description String?
  coverImage  String?
  published   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SiteSettings {
  id        String   @id @default(uuid())
  siteTitle String
  contact   String?
  email     String?
  instagram String?
  twitter   String?
  updatedAt DateTime @updatedAt
}

model Notification {
  id         String   @id @default(uuid())
  senderName String
  email      String?
  subject    String
  body       String
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
}

enum EmailPriority {
  LOW
  NORMAL
  HIGH
}

enum EmailStatus {
  QUEUED
  SENDING
  SENT
  FAILED
}

model EmailQueue {
  id             String        @id @default(uuid())
  to             String[]
  subject        String
  html           String
  priority       EmailPriority @default(NORMAL)
  status         EmailStatus   @default(QUEUED)
  retryCount     Int           @default(0)
  maxRetries     Int           @default(5)
  lastError      String?
  lastErrorStack String?
  nextRetryAt    DateTime?
  sentAt         DateTime?
  failedAt       DateTime?
  queuedAt       DateTime      @default(now())
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([status, nextRetryAt])
  @@index([priority, queuedAt])
  @@index([status, createdAt])
  @@map("email_queue")
}
UDESPORT_SRV_EOF_0_6

mkdir -p "$(dirname 'prisma/migrations/20260914140000_add_player_published/migration.sql')"
cat > 'prisma/migrations/20260914140000_add_player_published/migration.sql' << 'UDESPORT_SRV_EOF_1_6'
-- Real draft/publish support for players. Previously "Save as Draft" in the
-- admin form didn't actually save anything — this column is what makes
-- draft vs. published a real, queryable state instead of a no-op button.
-- Existing players default to true so nothing currently live disappears
-- from the public site once this migration is applied.
ALTER TABLE "Player" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;
UDESPORT_SRV_EOF_1_6

mkdir -p "$(dirname 'src/controllers/player.controller.ts')"
cat > 'src/controllers/player.controller.ts' << 'UDESPORT_SRV_EOF_2_6'
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
      .upload_stream({ folder, transformation: [{ width: 400, quality: "auto" }] }, (error, result) => {
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
          { folder: "udesport/players", transformation: [{ width: 800, quality: "auto" }] },
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
        .upload_stream({ folder: "udesport/players" }, (error, result) => {
          if (error || !result) reject(error);
          else resolve(result);
        })
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
UDESPORT_SRV_EOF_2_6

mkdir -p "$(dirname 'src/routes/player.routes.ts')"
cat > 'src/routes/player.routes.ts' << 'UDESPORT_SRV_EOF_3_6'
import { Router } from "express";
import {
  getPlayers,
  getPlayersAdmin,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  getDashboardStats,
} from "../controllers/player.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (anyone can view — your live website; published players only)
router.get("/", cacheMiddleware("players", 60), getPlayers);
router.get("/:id", cacheMiddleware("players", 60), getPlayer);

// PROTECTED ROUTES (logged-in admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getPlayersAdmin);
router.get("/stats/overview", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getDashboardStats);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("players"), createPlayer);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("players"), updatePlayer);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("players"), deletePlayer);

export default router;
UDESPORT_SRV_EOF_3_6

echo 'Done.'
echo ''
echo 'Next steps (same as the last migration):'
echo '  1. npx prisma migrate deploy   # applies the new published column to the live DB'
echo '  2. npx prisma generate          # regenerates the Prisma client'
echo '  3. npx tsc --noEmit             # sanity check'

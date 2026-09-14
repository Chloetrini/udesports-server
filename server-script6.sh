#!/usr/bin/env bash
set -e
echo "Applying server-script6: RETIRED player status + goalkeeper Saves/Clean Sheets fields (schema, migration, controller)."
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
  echo "Run this from the root of your udesports-server repo."
  exit 1
fi

mkdir -p "prisma"
cat > "prisma/schema.prisma" << 'SERVER6_EOF'
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
SERVER6_EOF

mkdir -p "prisma/migrations/20260914100000_add_retired_status_and_gk_stats"
cat > "prisma/migrations/20260914100000_add_retired_status_and_gk_stats/migration.sql" << 'SERVER6_EOF'
-- Add RETIRED as a valid PlayerStatus so a player who is no longer active
-- doesn't need a fake "current club" to display correctly.
ALTER TYPE "PlayerStatus" ADD VALUE 'RETIRED';

-- Goalkeeper-specific stats. Every player still has these columns (default 0)
-- so no schema branching is needed elsewhere; the frontend decides whether
-- to show goals/assists or saves/cleanSheets based on the player's position.
ALTER TABLE "Player" ADD COLUMN "saves" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "cleanSheets" INTEGER NOT NULL DEFAULT 0;
SERVER6_EOF

mkdir -p "src/controllers"
cat > "src/controllers/player.controller.ts" << 'SERVER6_EOF'
import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET ALL PLAYERS (public)
export const getPlayers = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
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
      currentClubLogo: currentClubLogo || null,
      newClubName: newClubName || null,
      newClubLogo: newClubLogo || null,
      playerHistory: playerHistory || null,
      playerAppearance: playerAppearance ? Number(playerAppearance) : 0,
      isFeatured: isFeatured === "true" || isFeatured === true ? true : false,
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
      currentClubLogo: currentClubLogo ?? undefined,
      newClubName: newClubName ?? undefined,
      newClubLogo: newClubLogo ?? undefined,
      playerHistory: playerHistory ?? undefined,
      playerAppearance: playerAppearance !== undefined ? Number(playerAppearance) : undefined,
      isFeatured:
        isFeatured === undefined ? undefined : isFeatured === "true" || isFeatured === true,
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
SERVER6_EOF

echo "Done writing files."
echo "IMPORTANT: this adds a real database migration. After reviewing the diff, run:"
echo "  npx prisma migrate deploy   (applies it to your database)"
echo "  npx prisma generate          (regenerates the Prisma client with the new fields)"
echo "  npx tsc --noEmit             (verify types)"

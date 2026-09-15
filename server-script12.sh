#!/bin/bash
set -e

echo 'Applying server-script12: StaffMember backend (real model with Cloudinary photo upload, to back the redesigned About page team cards) and Headline backend (real model to back the scrolling ticker bar under the navbar)...'

mkdir -p "$(dirname 'prisma/schema.prisma')"
cat > 'prisma/schema.prisma' << 'UDESPORT_SERVER_EOF_0_12'
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

enum QuickUpdateCategory {
  TRANSFER
  ACADEMY
  ANNOUNCEMENT
  MILESTONE
  INTERNATIONAL
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
  quickUpdates        QuickUpdate[]
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

model QuickUpdate {
  id        String              @id @default(uuid())
  headline  String
  category  QuickUpdateCategory
  published Boolean             @default(true)
  author    Admin               @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt
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

model Testimonial {
  id        String   @id @default(uuid())
  quote     String
  author    String
  club      String
  country   String
  published Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model StaffMember {
  id        String   @id @default(uuid())
  name      String
  role      String
  photo     String?
  verified  Boolean  @default(true)
  order     Int      @default(0)
  published Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Lowercase on purpose (unlike the other category enums) — it's a direct
// match for the icon-selection switch already shipped in UpdateBar.tsx on
// the frontend, so nothing there needs to change.
enum HeadlineCategory {
  transfer
  negotiation
  academy
  announcement
}

model Headline {
  id        String           @id @default(uuid())
  category  HeadlineCategory
  headline  String
  published Boolean          @default(true)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
}

model Subscriber {
  id                String   @id @default(uuid())
  email             String   @unique
  unsubscribeToken  String   @unique @default(uuid())
  createdAt         DateTime @default(now())
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
UDESPORT_SERVER_EOF_0_12

mkdir -p "$(dirname 'prisma/migrations/20260915120000_add_staff_member/migration.sql')"
cat > 'prisma/migrations/20260915120000_add_staff_member/migration.sql' << 'UDESPORT_SERVER_EOF_1_12'
-- The About page "Our Staff" section was still 100% hardcoded (name/role
-- only, no real photo — the frontend rendered a generic placeholder icon
-- instead). This gives it a real, admin-managed backing table with a
-- Cloudinary-hosted photo per staff member, matching the Figma design.
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photo" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);
UDESPORT_SERVER_EOF_1_12

mkdir -p "$(dirname 'prisma/migrations/20260915130000_add_headline/migration.sql')"
cat > 'prisma/migrations/20260915130000_add_headline/migration.sql' << 'UDESPORT_SERVER_EOF_2_12'
-- The scrolling ticker bar under the navbar ("Transfer / Negotiations /
-- Academy" items) was still 100% hardcoded on the frontend. This gives it
-- a real, admin-managed backing table.
CREATE TYPE "HeadlineCategory" AS ENUM ('transfer', 'negotiation', 'academy', 'announcement');

CREATE TABLE "Headline" (
    "id" TEXT NOT NULL,
    "category" "HeadlineCategory" NOT NULL,
    "headline" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Headline_pkey" PRIMARY KEY ("id")
);
UDESPORT_SERVER_EOF_2_12

mkdir -p "$(dirname 'src/controllers/staff.controller.ts')"
cat > 'src/controllers/staff.controller.ts' << 'UDESPORT_SERVER_EOF_3_12'
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
UDESPORT_SERVER_EOF_3_12

mkdir -p "$(dirname 'src/routes/staff.routes.ts')"
cat > 'src/routes/staff.routes.ts' << 'UDESPORT_SERVER_EOF_4_12'
import { Router } from "express";
import {
  getStaff,
  getStaffAdmin,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from "../controllers/staff.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (live website — published only)
router.get("/", cacheMiddleware("staff", 120), getStaff);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getStaffAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("staff"), createStaffMember);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("staff"), updateStaffMember);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("staff"), deleteStaffMember);

export default router;
UDESPORT_SERVER_EOF_4_12

mkdir -p "$(dirname 'src/controllers/headline.controller.ts')"
cat > 'src/controllers/headline.controller.ts' << 'UDESPORT_SERVER_EOF_5_12'
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
UDESPORT_SERVER_EOF_5_12

mkdir -p "$(dirname 'src/routes/headline.routes.ts')"
cat > 'src/routes/headline.routes.ts' << 'UDESPORT_SERVER_EOF_6_12'
import { Router } from "express";
import {
  getAllHeadlines,
  getAllHeadlinesAdmin,
  createHeadline,
  updateHeadline,
  deleteHeadline,
} from "../controllers/headline.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (live website — published only)
router.get("/", cacheMiddleware("headlines", 60), getAllHeadlines);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getAllHeadlinesAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("headlines"), createHeadline);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("headlines"), updateHeadline);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("headlines"), deleteHeadline);

export default router;
UDESPORT_SERVER_EOF_6_12

mkdir -p "$(dirname 'src/server.ts')"
cat > 'src/server.ts' << 'UDESPORT_SERVER_EOF_7_12'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import fileUpload from 'express-fileupload'
import cookieParser from 'cookie-parser'

import { connectDB, gracefulShutDown } from './config/db.js'
import { env } from './config/key.js'
import logger, { logError } from './config/logger.js'
import createSessionMiddleware from './config/session.js'
import { globalLimiter } from './middlewares/rateLimit.middleware.js'
import {
  appErrorHandler,
  createExpressLogger,
  notFoundRoutes,
  setupGlobalErrorHandlers,
} from './middlewares/error.middleware.js'

import authRoutes from './routes/auth.routes.js'
import newsRoutes from './routes/news.routes.js'
import playerRoutes from './routes/player.routes.js'
import settingsRoutes from './routes/settings.routes.js'
import galleryRoutes from './routes/gallery.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import emailRoutes from './routes/email.routes.js'
import quickUpdateRoutes from './routes/quickUpdate.routes.js'
import testimonialRoutes from './routes/testimonial.routes.js'
import newsletterRoutes from './routes/newsletter.routes.js'
import staffRoutes from './routes/staff.routes.js'
import headlineRoutes from './routes/headline.routes.js'

// Extend express-session with UDESport's admin session shape
declare module 'express-session' {
  interface SessionData {
    userId?: string
    role?: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_ADMIN'
  }
}

const app = express()

setupGlobalErrorHandlers()

// Cron route first — lean path, no session/CORS needed, auth via x-cron-secret
app.use('/api', emailRoutes)

// CORS
// Always allow both local dev ports regardless of CLIENT_URL, so testing a
// local frontend against this deployed (or local) backend keeps working no
// matter what CLIENT_URL is set to for production. The client's vite.config.ts
// pins the dev server to port 4001; 5173 is Vite's own default, kept as a
// fallback in case that ever changes back.
app.use(
  cors({
    origin: [env.CLIENT_URL || 'http://localhost:4002', 'http://localhost:4003', 'http://localhost:4001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.set('trust proxy', 1)
app.use(createExpressLogger())
app.use(createSessionMiddleware())
app.use(globalLimiter)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(
  fileUpload({
    useTempFiles: false,
    limits: { fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
  })
)
app.use(cookieParser())
app.disable('x-powered-by')

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/players', playerRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/gallery', galleryRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/quick-updates', quickUpdateRoutes)
app.use('/api/testimonials', testimonialRoutes)
app.use('/api/newsletter', newsletterRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/headlines', headlineRoutes)

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'UDESport API is running' })
})

// 404 + error handler (must be last)
app.use(notFoundRoutes)
app.use(appErrorHandler)

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4200

const startServer = async (): Promise<void> => {
  let server: any
  try {
    await connectDB()
    server = app.listen(PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`)
      logger.info(`http://localhost:${PORT}`)
    })

    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)
      logger.error({ reason: error }, 'Unhandled rejection')
      server.close(() => {
        logger.info('Process terminated due to unhandled rejection')
      })
    })

    process.on('SIGTERM', gracefulShutDown)
    process.on('SIGINT', gracefulShutDown)

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') throw error
      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`)
          process.exit(1)
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`)
          process.exit(1)
        default:
          throw error
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logError(`Failed to start server: ${errorMessage}`)
    process.exit(1)
  }
}

if (!process.env.VERCEL) {
  startServer()
} else {
  connectDB().catch(err => {
    logger.error({ err }, 'Serverless DB connection failed')
  })
}

export default app
UDESPORT_SERVER_EOF_7_12

echo 'Done. IMPORTANT: run these before anything will build:'
echo '  npx prisma generate'
echo '  npx prisma migrate deploy'
echo 'Then verify with: npx tsc --noEmit'

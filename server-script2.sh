#!/usr/bin/env bash
set -euo pipefail
echo "Applying UDESPORT backend round-2: Vercel deployment support + PlayerStatus enum rename + missing dependencies..."

mkdir -p "$(dirname "package.json")"
cat > "package.json" << 'UDES2_01_EOF'
{
  "name": "udesport-server",
  "version": "1.0.0",
  "description": "",
  "main": "server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "seed": "tsx src/utils/seedAdmin.ts",
    "postinstall": "prisma generate"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/express-fileupload": "^1.5.1",
    "@types/express-session": "^1.19.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^26.0.0",
    "@types/validator": "^13.15.10",
    "nodemon": "^3.1.14",
    "prisma": "^7.8.0",
    "ts-node": "^10.9.2",
    "tsx": "^4.22.4",
    "typescript": "^6.0.3"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "axios": "^1.20.0",
    "bcrypt": "^6.0.0",
    "cloudinary": "^2.10.0",
    "connect-pg-simple": "^10.0.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "express-fileupload": "^1.5.2",
    "express-rate-limit": "^8.7.0",
    "express-session": "^1.19.0",
    "jsonwebtoken": "^9.0.3",
    "memjs": "^1.3.2",
    "mongodb": "^7.3.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "pino-pretty": "^13.1.3",
    "validator": "^13.15.35"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
UDES2_01_EOF
echo "  wrote package.json"

mkdir -p "$(dirname "prisma/schema.prisma")"
cat > "prisma/schema.prisma" << 'UDES2_02_EOF'
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
UDES2_02_EOF
echo "  wrote prisma/schema.prisma"

mkdir -p "$(dirname "prisma/migrations/20260911123106_rename_player_status_values/migration.sql")"
cat > "prisma/migrations/20260911123106_rename_player_status_values/migration.sql" << 'UDES2_03_EOF'
-- Rename PlayerStatus enum values to match the frontend's status vocabulary
-- (the admin dashboard displays "Free" / "Transferred" / "Negotiation").
-- Postgres enum RENAME VALUE keeps existing rows intact — no data migration needed.

ALTER TYPE "PlayerStatus" RENAME VALUE 'CONTRACTED' TO 'TRANSFERRED';
ALTER TYPE "PlayerStatus" RENAME VALUE 'LOANED' TO 'NEGOTIATION';
UDES2_03_EOF
echo "  wrote prisma/migrations/20260911123106_rename_player_status_values/migration.sql"

mkdir -p "$(dirname "src/config/prisma.ts")"
cat > "src/config/prisma.ts" << 'UDES2_04_EOF'
import 'dotenv/config'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import logger, { logError } from './logger.js'
import { env } from './key.js'

const isDev = env.NODE_ENV === 'development'

// Reuse a single client + pool across hot-reloads in dev, AND across warm
// invocations of the same serverless function (Vercel) in production — a
// long-running server only ever loads this module once anyway, so caching
// here is free there, but on Vercel each cold start would otherwise open a
// brand new pool of up to `max` connections with no way to close the old
// one, exhausting the database's connection limit under real traffic.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  pool?: Pool
}

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20, //pool size lives here, not in Prisma
  })

//log pool-level errors (dropped connections are handled by the pool itself)
pool.on('error', err => logError(err, 'pg pool error'))

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: isDev ? ['query', 'error', 'warn'] : ['error'],
  })

globalForPrisma.prisma = prisma
globalForPrisma.pool = pool

export {  pool }
export default prisma
UDES2_04_EOF
echo "  wrote src/config/prisma.ts"

mkdir -p "$(dirname "src/types/memjs.d.ts")"
cat > "src/types/memjs.d.ts" << 'UDES2_05_EOF'
declare module 'memjs' {
  export class Client {
    static create(servers?: string, options?: Record<string, unknown>): Client;
    get(key: string): Promise<{ value: Buffer | null }>;
    set(key: string, value: string | Buffer, options?: Record<string, unknown>): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    flush(): Promise<boolean[]>;
    increment(key: string, amount: number, options?: Record<string, unknown>): Promise<{ value: number | null; success: boolean }>;
    quit(): void;
  }
}
UDES2_05_EOF
echo "  wrote src/types/memjs.d.ts"

mkdir -p "$(dirname "vercel.json")"
cat > "vercel.json" << 'UDES2_06_EOF'
{
  "version": 2,
  "rewrites": [
    { "source": "/(.*)", "destination": "/api" }
  ]
}
UDES2_06_EOF
echo "  wrote vercel.json"

mkdir -p "$(dirname "api/index.ts")"
cat > "api/index.ts" << 'UDES2_07_EOF'
// Vercel serverless entry point. Vercel treats every file under /api as its
// own serverless function; this one just re-exports the existing Express
// app so the whole backend runs behind a single function.
//
// vercel.json rewrites every request to this function, and Express's own
// router (mounted at /api/... in src/server.ts) handles the real routing
// from there — so the frontend keeps calling the same /api/... paths it
// already uses locally.
//
// src/server.ts already guards its startServer()/app.listen() call behind
// `if (!process.env.VERCEL)`, so importing it here does not try to bind a
// port — it only connects to the database and exports the app.
import app from '../src/server'

export default app
UDES2_07_EOF
echo "  wrote api/index.ts"

echo ""
echo "Done. Next steps:"
echo "  1. npm install                    (installs axios, express-session, memjs, pino-http, express-rate-limit, connect-pg-simple types, and runs postinstall: prisma generate)"
echo "  2. npx prisma migrate deploy       (only if you have NOT already applied the PlayerStatus rename to this database)"
echo "  3. npx tsc --noEmit                (should be fully clean now)"
echo "  4. git add -A && git commit -m \"wire backend: enum rename, missing deps, Vercel support\" && git push"
echo "  5. In the Vercel dashboard: import this repo, set the required env vars (DATABASE_URL, NODE_ENV, CLOUDINARY_*, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET, SESSION_SECRET, SESSION_MAX_AGE, BREVO_API_KEY, EMAIL_FROM, EMAIL_OWNER, CLIENT_URL, LOG_LEVEL, MEMCACHIER_SERVERS, MEMCACHIER_USERNAME, MEMCACHIER_PASSWORD, CRON_SECRET), and deploy."
echo "  6. Set CLIENT_URL to your actual deployed frontend URL (CORS depends on it), and update the frontend VITE_API_URL to https://<your-vercel-app>.vercel.app/api"

#!/usr/bin/env bash
set -e
echo "Applying UDESPORT backend change: rename PlayerStatus enum values to match the frontend (Free/Transferred/Negotiation)..."

mkdir -p "prisma"
cat > "prisma/schema.prisma" << 'EOF_UDEx_187e4a6f'
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
EOF_UDEx_187e4a6f
echo "  wrote prisma/schema.prisma"

mkdir -p "prisma/migrations/20260911123106_rename_player_status_values"
cat > "prisma/migrations/20260911123106_rename_player_status_values/migration.sql" << 'EOF_UDEx_664dc352'
-- Rename PlayerStatus enum values to match the frontend's status vocabulary
-- (the admin dashboard displays "Free" / "Transferred" / "Negotiation").
-- Postgres enum RENAME VALUE keeps existing rows intact — no data migration needed.

ALTER TYPE "PlayerStatus" RENAME VALUE 'CONTRACTED' TO 'TRANSFERRED';
ALTER TYPE "PlayerStatus" RENAME VALUE 'LOANED' TO 'NEGOTIATION';

EOF_UDEx_664dc352
echo "  wrote prisma/migrations/20260911123106_rename_player_status_values/migration.sql"

echo ""
echo "Done. Next steps:"
echo "  1. npx prisma generate            (regenerates the Prisma client with the new enum values)"
echo "  2. npx prisma migrate deploy       (applies the migration to your database — RENAME VALUE, no data loss)"
echo "     (use \"npx prisma migrate dev\" instead if this is your local dev database)"
echo "  3. restart the server"

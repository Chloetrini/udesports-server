-- CreateEnum
CREATE TYPE "EmailPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "to" TEXT[],
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "priority" "EmailPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "lastErrorStack" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_queue_status_nextRetryAt_idx" ON "email_queue"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "email_queue_priority_queuedAt_idx" ON "email_queue"("priority", "queuedAt");

-- CreateIndex
CREATE INDEX "email_queue_status_createdAt_idx" ON "email_queue"("status", "createdAt");

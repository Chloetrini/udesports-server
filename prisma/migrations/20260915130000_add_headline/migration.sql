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

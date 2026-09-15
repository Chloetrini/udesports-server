-- The News page's "Quick Updates" sidebar widget was still hardcoded mock
-- data on the frontend — this gives it a real, admin-managed backing table
-- instead. Short, dated blurbs (transfer news, milestones, etc.), separate
-- from the full News articles.
CREATE TYPE "QuickUpdateCategory" AS ENUM ('TRANSFER', 'ACADEMY', 'ANNOUNCEMENT', 'MILESTONE', 'INTERNATIONAL');

CREATE TABLE "QuickUpdate" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "category" "QuickUpdateCategory" NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickUpdate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuickUpdate" ADD CONSTRAINT "QuickUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

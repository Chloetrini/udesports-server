-- The About page "Award & Certification" section was still 100% hardcoded
-- (name/subtitle only, generic icon — no real certificate/logo image).
-- This gives it a real, admin-managed backing table with a Cloudinary-
-- hosted image per award, matching the Figma design.
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);


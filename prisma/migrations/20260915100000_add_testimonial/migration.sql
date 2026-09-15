-- The home page testimonial carousel ("WHAT CLUBS AND FAMILY SAY") was
-- still 100% hardcoded mock data on the frontend — this gives it a real,
-- admin-managed backing table instead.
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

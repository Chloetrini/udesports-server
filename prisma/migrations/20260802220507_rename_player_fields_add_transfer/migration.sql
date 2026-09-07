/*
  Warnings:

  - You are about to drop the column `background` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Player` table. All the data in the column will be lost.
  - Added the required column `DOB` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `playerName` to the `Player` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Player" DROP COLUMN "background",
DROP COLUMN "dateOfBirth",
DROP COLUMN "imageUrl",
DROP COLUMN "name",
ADD COLUMN     "DOB" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "currentClubLogo" TEXT,
ADD COLUMN     "currentClubName" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "newClubLogo" TEXT,
ADD COLUMN     "newClubName" TEXT,
ADD COLUMN     "playerAppearance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "playerFullName" TEXT,
ADD COLUMN     "playerHistory" TEXT,
ADD COLUMN     "playerName" TEXT NOT NULL,
ADD COLUMN     "playerPhoto" TEXT;

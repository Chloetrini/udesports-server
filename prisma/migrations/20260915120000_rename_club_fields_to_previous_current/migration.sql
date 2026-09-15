/*
  Renames the Player club fields so the names match what they actually mean:

    currentClubName/Logo (the club before a transfer) -> previousClubName/Logo
    newClubName/Logo     (the club after a transfer)   -> currentClubName/Logo

  These are in-place RENAME COLUMN statements, not drop+recreate, so every
  existing player's club data is preserved — a player who already had a
  "Current Club" set keeps that same club, now correctly understood as
  their previous one, and whatever was in "New Club" becomes their current
  one. The rename order matters: currentClubName/Logo must move out of the
  way (-> previousClubName/Logo) before newClubName/Logo takes the
  currentClubName/Logo name, so the two renames never collide.
*/

-- AlterTable
ALTER TABLE "Player" RENAME COLUMN "currentClubName" TO "previousClubName";
ALTER TABLE "Player" RENAME COLUMN "currentClubLogo" TO "previousClubLogo";
ALTER TABLE "Player" RENAME COLUMN "newClubName" TO "currentClubName";
ALTER TABLE "Player" RENAME COLUMN "newClubLogo" TO "currentClubLogo";

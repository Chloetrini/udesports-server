-- Add RETIRED as a valid PlayerStatus so a player who is no longer active
-- doesn't need a fake "current club" to display correctly.
ALTER TYPE "PlayerStatus" ADD VALUE 'RETIRED';

-- Goalkeeper-specific stats. Every player still has these columns (default 0)
-- so no schema branching is needed elsewhere; the frontend decides whether
-- to show goals/assists or saves/cleanSheets based on the player's position.
ALTER TABLE "Player" ADD COLUMN "saves" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "cleanSheets" INTEGER NOT NULL DEFAULT 0;

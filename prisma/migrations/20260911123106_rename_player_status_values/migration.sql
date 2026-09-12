-- Rename PlayerStatus enum values to match the frontend's status vocabulary
-- (the admin dashboard displays "Free" / "Transferred" / "Negotiation").
-- Postgres enum RENAME VALUE keeps existing rows intact — no data migration needed.

ALTER TYPE "PlayerStatus" RENAME VALUE 'CONTRACTED' TO 'TRANSFERRED';
ALTER TYPE "PlayerStatus" RENAME VALUE 'LOANED' TO 'NEGOTIATION';

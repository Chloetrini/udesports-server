-- Real draft/publish support for players. Previously "Save as Draft" in the
-- admin form didn't actually save anything — this column is what makes
-- draft vs. published a real, queryable state instead of a no-op button.
-- Existing players default to true so nothing currently live disappears
-- from the public site once this migration is applied.
ALTER TABLE "Player" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

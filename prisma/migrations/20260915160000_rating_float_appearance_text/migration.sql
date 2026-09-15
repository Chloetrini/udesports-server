/*
  Two field-type changes so the admin form can accept free-form input
  instead of a plain number-with-spinner:

    rating: Int -> Float, so a decimal rating (e.g. 8.5) can be saved
    exactly as typed, instead of being rounded to a whole number.

    playerAppearance: Int -> String, so a trailing "+" can be saved
    (e.g. "382+"), not just a plain count. Existing numeric values are
    cast straight across as text (382 -> "382"), nothing is lost.
*/

-- AlterTable
ALTER TABLE "Player" ALTER COLUMN "rating" TYPE DOUBLE PRECISION USING "rating"::double precision;

ALTER TABLE "Player" ALTER COLUMN "playerAppearance" DROP DEFAULT;
ALTER TABLE "Player" ALTER COLUMN "playerAppearance" TYPE TEXT USING "playerAppearance"::text;
ALTER TABLE "Player" ALTER COLUMN "playerAppearance" SET DEFAULT '0';

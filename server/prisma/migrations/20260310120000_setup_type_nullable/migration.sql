-- Make setupType optional (null) instead of storing sentinel "Unknown"

ALTER TABLE "trades"
ALTER COLUMN "setupType" DROP NOT NULL;

UPDATE "trades"
SET "setupType" = NULL
WHERE "setupType" IS NULL
   OR btrim("setupType") = ''
   OR "setupType" = 'Unknown';


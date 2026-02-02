-- Idempotent: SET DEFAULT is safe to run multiple times (overwrites existing default)
ALTER TABLE "cards" ALTER COLUMN "height" SET DEFAULT 200;
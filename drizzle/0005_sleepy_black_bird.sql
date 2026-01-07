ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "reactions" jsonb DEFAULT '{}'::jsonb NOT NULL;

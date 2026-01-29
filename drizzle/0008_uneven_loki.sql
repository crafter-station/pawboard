ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "width" integer DEFAULT 224 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "height" integer DEFAULT 160 NOT NULL;

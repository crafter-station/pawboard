ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "move_permission" text DEFAULT 'creator' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "delete_permission" text DEFAULT 'creator' NOT NULL;
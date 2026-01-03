ALTER TABLE "sessions" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "move_permission" text DEFAULT 'creator' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "delete_permission" text DEFAULT 'creator' NOT NULL;
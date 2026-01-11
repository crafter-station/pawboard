ALTER TABLE "session_participants" ADD COLUMN IF NOT EXISTS "last_active_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp DEFAULT now() NOT NULL;

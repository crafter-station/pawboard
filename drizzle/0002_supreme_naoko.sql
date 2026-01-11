CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN IF NOT EXISTS "joined_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" DROP CONSTRAINT IF EXISTS "session_participants_visitor_id_session_id_pk";--> statement-breakpoint
ALTER TABLE "session_participants" DROP CONSTRAINT IF EXISTS "session_participants_user_id_session_id_pk";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_session_id_pk" PRIMARY KEY("user_id","session_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_created_by_id_users_id_fk";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cards" ADD CONSTRAINT "cards_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "session_participants" DROP CONSTRAINT IF EXISTS "session_participants_user_id_users_id_fk";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN IF EXISTS "created_by";--> statement-breakpoint
ALTER TABLE "session_participants" DROP COLUMN IF EXISTS "visitor_id";--> statement-breakpoint
ALTER TABLE "session_participants" DROP COLUMN IF EXISTS "username";--> statement-breakpoint
ALTER TABLE "session_participants" DROP COLUMN IF EXISTS "updated_at";

DO $$ BEGIN
  ALTER TABLE "card_edit_history" DROP CONSTRAINT "card_edit_history_user_id_users_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cards" DROP CONSTRAINT "cards_created_by_id_users_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "comments" DROP CONSTRAINT "comments_created_by_id_users_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_participants" DROP CONSTRAINT "session_participants_user_id_users_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "threads" DROP CONSTRAINT "threads_created_by_id_users_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;

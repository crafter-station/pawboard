CREATE TABLE IF NOT EXISTS "card_edit_history" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"edited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_edit_history" ADD CONSTRAINT "card_edit_history_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_edit_history" ADD CONSTRAINT "card_edit_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_edit_history_card_idx" ON "card_edit_history" USING btree ("card_id");--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "move_permission";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "delete_permission";
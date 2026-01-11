CREATE TABLE IF NOT EXISTS "board_files" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"ingestion_status" text DEFAULT 'pending' NOT NULL,
	"ingestion_error" text,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "board_files" ADD CONSTRAINT "board_files_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "board_files" ADD CONSTRAINT "board_files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_board_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."board_files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_chunks_embedding_idx" ON "file_chunks" USING hnsw ("embedding" vector_cosine_ops);

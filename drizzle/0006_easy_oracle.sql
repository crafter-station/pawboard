CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_embedding_idx" ON "cards" USING hnsw ("embedding" vector_cosine_ops);

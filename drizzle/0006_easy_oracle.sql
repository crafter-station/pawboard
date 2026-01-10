CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "cards" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "cards_embedding_idx" ON "cards" USING hnsw ("embedding" vector_cosine_ops);

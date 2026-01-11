import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { embedMany } from "ai";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { nanoid } from "nanoid";
import postgres from "postgres";
import type { NewFileChunk } from "../../db/schema";
import * as schema from "../../db/schema";
import { boardFiles, fileChunks } from "../../db/schema";
import { chunkText, getChunkStats } from "../../lib/files/chunking";

// Create database client for Trigger.dev runtime
function createDbClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

// Create Supabase admin client for storage access
function createStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const BUCKET_NAME = "board-files";
const MAX_EMBEDDING_BATCH_SIZE = 100; // OpenAI limit

export interface IngestFilePayload {
  fileId: string;
}

export const ingestFileTask = task({
  id: "ingest-file",
  maxDuration: 600, // 10 minutes max
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: IngestFilePayload, { ctx }) => {
    const { fileId } = payload;
    logger.info("Starting file ingestion", { fileId });

    const db = createDbClient();
    const supabase = createStorageClient();

    try {
      // 1. Fetch file metadata from DB
      const file = await db.query.boardFiles.findFirst({
        where: eq(boardFiles.id, fileId),
      });

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      logger.info("Found file", {
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.sizeBytes,
      });

      // Update status to processing
      await db
        .update(boardFiles)
        .set({ ingestionStatus: "processing" })
        .where(eq(boardFiles.id, fileId));

      // 2. Download file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(file.storagePath);

      if (downloadError || !fileData) {
        throw new Error(
          `Failed to download file: ${downloadError?.message || "Unknown error"}`,
        );
      }

      // 3. Parse file content
      const textContent = await fileData.text();
      logger.info("File content loaded", { length: textContent.length });

      if (textContent.trim().length === 0) {
        // Empty file - mark as completed with no chunks
        await db
          .update(boardFiles)
          .set({
            ingestionStatus: "completed",
            processedAt: new Date(),
          })
          .where(eq(boardFiles.id, fileId));

        return {
          success: true,
          fileId,
          chunksCreated: 0,
          message: "File is empty, no chunks created",
        };
      }

      // 4. Chunk the content
      const isMarkdown = file.mimeType === "text/markdown";
      const chunks = chunkText(textContent, {
        maxChunkSize: 1000,
        overlap: 200,
        preserveMarkdown: isMarkdown,
      });

      const stats = getChunkStats(chunks);
      logger.info("Text chunked", stats);

      if (chunks.length === 0) {
        await db
          .update(boardFiles)
          .set({
            ingestionStatus: "completed",
            processedAt: new Date(),
          })
          .where(eq(boardFiles.id, fileId));

        return {
          success: true,
          fileId,
          chunksCreated: 0,
          message: "No chunks created from file content",
        };
      }

      // 5. Generate embeddings in batches
      const allChunkRecords: NewFileChunk[] = [];

      for (let i = 0; i < chunks.length; i += MAX_EMBEDDING_BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + MAX_EMBEDDING_BATCH_SIZE);
        const batchTexts = batchChunks.map((c) => c.content);

        logger.info("Generating embeddings batch", {
          batchStart: i,
          batchSize: batchChunks.length,
          totalChunks: chunks.length,
        });

        const { embeddings } = await embedMany({
          model: "text-embedding-3-small",
          values: batchTexts,
        });

        // Create chunk records with embeddings
        for (let j = 0; j < batchChunks.length; j++) {
          const chunk = batchChunks[j];
          const embedding = embeddings[j];

          allChunkRecords.push({
            id: nanoid(20),
            fileId,
            chunkIndex: chunk.index,
            content: chunk.content,
            embedding,
          });
        }
      }

      // 6. Insert chunks into database
      logger.info("Inserting chunks into database", {
        count: allChunkRecords.length,
      });

      // Insert in batches to avoid query size limits
      const BATCH_INSERT_SIZE = 50;
      for (let i = 0; i < allChunkRecords.length; i += BATCH_INSERT_SIZE) {
        const batch = allChunkRecords.slice(i, i + BATCH_INSERT_SIZE);
        await db.insert(fileChunks).values(batch);
      }

      // 7. Update file status to completed
      await db
        .update(boardFiles)
        .set({
          ingestionStatus: "completed",
          processedAt: new Date(),
        })
        .where(eq(boardFiles.id, fileId));

      logger.info("File ingestion completed", {
        fileId,
        chunksCreated: allChunkRecords.length,
      });

      return {
        success: true,
        fileId,
        chunksCreated: allChunkRecords.length,
        stats,
      };
    } catch (error) {
      logger.error("File ingestion failed", {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Update file status to failed
      await db
        .update(boardFiles)
        .set({
          ingestionStatus: "failed",
          ingestionError:
            error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(boardFiles.id, fileId));

      throw error; // Re-throw to trigger retry
    }
  },
});
